<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Models\LinkCodeModel;
use App\Models\ParentStudentLinkModel;
use App\Models\ProfileModel;
use RuntimeException;
use Throwable;

/**
 * Parent ↔ student linking. A link exists only after the student shares a fresh code.
 */
class LinkService
{
    private const BAD_CODE = "That code didn't work. Ask your child for a new code.";

    /**
     * Issues a new 6-character code (24 h), replacing the student's unused codes.
     *
     * @param int $studentId Student
     * @return array{code: string, expires_at: ?string}
     */
    public function createCode(int $studentId): array
    {
        $model = model(LinkCodeModel::class);

        try {
            foreach ($model->where('student_id', $studentId)->where('used_at', null)->findAll() as $old) {
                $model->delete((int) $old['id']);
            }

            $expires = Format::now('+24 hours');
            $code    = $this->insertUniqueCode($model, $studentId, $expires);
        } catch (Throwable $e) {
            log_message('error', '[LinkService::createCode] ' . $e->getMessage());

            throw $e;
        }

        return ['code' => $code, 'expires_at' => Format::iso($expires)];
    }

    /**
     * Links the parent to the student who owns a valid code, consuming the code.
     *
     * @param int                  $parentId Parent
     * @param array<string, mixed> $input    { code }
     * @return array{student: array{id: int, first_name: ?string, grade: ?int}}
     * @throws ApiException 400 for any bad / used / expired code
     */
    public function linkParent(int $parentId, array $input): array
    {
        $code = is_string($input['code'] ?? null) ? strtoupper(trim($input['code'])) : '';

        if (preg_match('/^[A-Z0-9]{6}$/', $code) !== 1) {
            throw new ApiException(self::BAD_CODE, 400);
        }

        $codes = model(LinkCodeModel::class);
        $row   = $codes->where('code', $code)->where('used_at', null)->where('expires_at >', Format::now())->first();

        if ($row === null) {
            throw new ApiException(self::BAD_CODE, 400);
        }

        $studentId = (int) $row['student_id'];
        $codes->update((int) $row['id'], ['used_at' => Format::now()]);
        $this->ensureLink($parentId, $studentId);

        $student = model(ProfileModel::class)->where('user_id', $studentId)->first();

        return ['student' => [
            'id'         => $studentId,
            'first_name' => $student['first_name'] ?? null,
            'grade'      => Format::intOrNull($student['grade'] ?? null),
        ]];
    }

    /**
     * Students linked to a parent.
     *
     * @param int $parentId Parent
     * @return list<array{id: int, first_name: ?string, last_name: ?string, grade: ?int, primary_subject: ?string}>
     */
    public function students(int $parentId): array
    {
        $rows = model(ParentStudentLinkModel::class)
            ->select('profiles.user_id, profiles.first_name, profiles.last_name, profiles.grade, profiles.primary_subject')
            ->join('profiles', 'profiles.user_id = parent_student_links.student_id')
            ->where('parent_student_links.parent_id', $parentId)
            ->orderBy('profiles.first_name', 'ASC')
            ->findAll();

        return array_map(static fn (array $r): array => [
            'id'              => (int) $r['user_id'],
            'first_name'      => $r['first_name'],
            'last_name'       => $r['last_name'],
            'grade'           => Format::intOrNull($r['grade']),
            'primary_subject' => $r['primary_subject'],
        ], $rows);
    }

    /**
     * Activity of a linked student.
     *
     * @param int $parentId  Parent
     * @param int $studentId Student user id
     * @return array{student: array<string, mixed>, sessions: list<array<string, mixed>>, answers: list<array<string, mixed>>}
     * @throws ApiException 403 when not linked
     */
    public function activity(int $parentId, int $studentId): array
    {
        $linked = model(ParentStudentLinkModel::class)
            ->where(['parent_id' => $parentId, 'student_id' => $studentId])->first();

        if ($linked === null) {
            throw new ApiException('You are not linked to this learner.', 403);
        }

        $profile = model(ProfileModel::class)->where('user_id', $studentId)->first() ?? [];

        return [
            'student'  => [
                'id'              => $studentId,
                'first_name'      => $profile['first_name'] ?? null,
                'last_name'       => $profile['last_name'] ?? null,
                'grade'           => Format::intOrNull($profile['grade'] ?? null),
                'primary_subject' => $profile['primary_subject'] ?? null,
            ],
            'sessions' => LearningService::sessions($studentId),
            'answers'  => LearningService::answers($studentId),
        ];
    }

    /**
     * Inserts a code, retrying on the (unlikely) unique collision.
     *
     * @param LinkCodeModel $model     Model
     * @param int           $studentId Student
     * @param string        $expires   Expiry DATETIME
     * @return string The code
     */
    private function insertUniqueCode(LinkCodeModel $model, int $studentId, string $expires): string
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $code = Format::randomCode(6);

            if ($model->where('code', $code)->countAllResults() > 0) {
                continue;
            }

            if ($model->insert(['code' => $code, 'student_id' => $studentId, 'expires_at' => $expires]) === false) {
                throw new RuntimeException('Link code insert failed: ' . implode(', ', $model->errors()));
            }

            return $code;
        }

        throw new RuntimeException('Could not generate a unique link code.');
    }

    /**
     * Creates the parent↔student link if missing.
     *
     * @param int $parentId  Parent
     * @param int $studentId Student
     */
    private function ensureLink(int $parentId, int $studentId): void
    {
        $model = model(ParentStudentLinkModel::class);

        if ($model->where(['parent_id' => $parentId, 'student_id' => $studentId])->first() !== null) {
            return;
        }

        if ($model->insert(['parent_id' => $parentId, 'student_id' => $studentId]) === false) {
            log_message('error', '[LinkService::ensureLink] ' . implode(', ', $model->errors()));

            throw new RuntimeException('Link insert failed.');
        }
    }
}
