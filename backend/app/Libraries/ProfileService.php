<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Models\ProfileModel;
use RuntimeException;
use Throwable;

/**
 * Reads, formats and updates profiles. Role and email are never writable here.
 */
class ProfileService
{
    /** Fields a user may change on their own profile. */
    private const EDITABLE = ['first_name', 'last_name', 'grade', 'primary_subject', 'subjects', 'school', 'companion'];

    /**
     * Loads the profile row for a user.
     *
     * @param int $userId Shield user id
     * @return array<string, mixed> Profile row
     * @throws ApiException 404 when the profile is missing
     */
    public function rowFor(int $userId): array
    {
        $row = model(ProfileModel::class)->where('user_id', $userId)->first();

        if ($row === null) {
            throw new ApiException('Profile not found.', 404);
        }

        return $row;
    }

    /**
     * Returns the contract's profile object for a user.
     *
     * @param int $userId Shield user id
     * @return array<string, mixed>
     */
    public function get(int $userId): array
    {
        return self::format($this->rowFor($userId));
    }

    /**
     * Updates the caller's editable profile fields.
     *
     * @param int                  $userId Shield user id
     * @param array<string, mixed> $input  Request body
     * @return array<string, mixed> Updated profile object
     * @throws ApiException 422 on invalid input
     */
    public function update(int $userId, array $input): array
    {
        $input = array_intersect_key($input, array_flip(self::EDITABLE));

        InputValidator::check($input, [
            'first_name'      => 'permit_empty|max_length[100]',
            'last_name'       => 'permit_empty|max_length[100]',
            'grade'           => 'permit_empty|is_natural|greater_than_equal_to[8]|less_than_equal_to[12]',
            'primary_subject' => 'permit_empty|max_length[100]',
            'school'          => 'permit_empty|max_length[150]',
            'companion'       => 'permit_empty|max_length[50]',
        ], ['grade' => [
            'greater_than_equal_to' => 'Grade must be between 8 and 12.',
            'less_than_equal_to'    => 'Grade must be between 8 and 12.',
        ]]);

        $changes = $this->buildChanges($input);
        $row     = $this->rowFor($userId);

        if ($changes !== []) {
            $this->save((int) $row['id'], $changes);
        }

        return $this->get($userId);
    }

    /**
     * Formats a profile row into the API profile object.
     *
     * @param array<string, mixed> $row profiles row
     * @return array<string, mixed>
     */
    public static function format(array $row): array
    {
        $isStudent = $row['role'] === 'student';
        $hasName   = ($row['first_name'] ?? '') !== '' && $row['first_name'] !== null;
        $complete  = $isStudent
            ? $hasName && $row['grade'] !== null && ($row['primary_subject'] ?? '') !== ''
            : $hasName;

        return [
            'id'              => (int) $row['user_id'],
            'email'           => $row['email'],
            'role'            => $row['role'],
            'first_name'      => $row['first_name'],
            'last_name'       => $row['last_name'],
            'grade'           => Format::intOrNull($row['grade']),
            'primary_subject' => $row['primary_subject'],
            'subjects'        => array_values(Format::jsonArray($row['subjects'])),
            'school'          => $row['school'],
            'dob'             => $row['dob'],
            'companion'       => $row['companion'],
            'setup_complete'  => $complete,
            'created_at'      => Format::iso($row['created_at']),
            'updated_at'      => Format::iso($row['updated_at']),
        ];
    }

    /**
     * Normalises validated input into column values.
     *
     * @param array<string, mixed> $input Editable fields only
     * @return array<string, mixed>
     * @throws ApiException 422 when subjects is malformed
     */
    private function buildChanges(array $input): array
    {
        $changes = [];

        foreach (['first_name', 'last_name', 'primary_subject', 'school', 'companion'] as $field) {
            if (array_key_exists($field, $input)) {
                $changes[$field] = InputValidator::optionalString($input, $field);
            }
        }

        if (array_key_exists('grade', $input)) {
            $changes['grade'] = Format::intOrNull($input['grade']);
        }

        if (array_key_exists('subjects', $input)) {
            $changes['subjects'] = $this->encodeSubjects($input['subjects']);
        }

        return $changes;
    }

    /**
     * Validates and JSON-encodes the subjects list.
     *
     * @param mixed $subjects Request value
     * @throws ApiException 422 when not a list of short strings
     */
    private function encodeSubjects(mixed $subjects): ?string
    {
        if ($subjects === null) {
            return null;
        }

        if (! is_array($subjects) || ! array_is_list($subjects) || count($subjects) > 20) {
            throw ApiException::validation(['subjects' => 'Subjects must be a list of up to 20 subject names.']);
        }

        $clean = [];

        foreach ($subjects as $subject) {
            $name = is_string($subject) ? Format::cleanText($subject) : '';

            if ($name === '' || mb_strlen($name) > 100) {
                throw ApiException::validation(['subjects' => 'Each subject must be a name of up to 100 characters.']);
            }

            $clean[] = $name;
        }

        return json_encode(array_values(array_unique($clean)), JSON_UNESCAPED_UNICODE);
    }

    /**
     * Persists profile changes through the model (validated + audited).
     *
     * @param int                  $profileId profiles.id
     * @param array<string, mixed> $changes   Column values
     * @throws RuntimeException When the update fails
     */
    private function save(int $profileId, array $changes): void
    {
        $model = model(ProfileModel::class);

        try {
            if (! $model->update($profileId, $changes)) {
                throw new RuntimeException('Profile update failed: ' . implode(', ', $model->errors()));
            }
        } catch (Throwable $e) {
            log_message('error', '[ProfileService::save] ' . $e->getMessage());

            throw $e;
        }
    }
}
