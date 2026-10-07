<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Models\SignupApplicationModel;
use Config\Archie;
use RuntimeException;
use Throwable;

/**
 * Teacher/parent applications: validated, vetted by Claude (fail-safe to NEEDS_REVIEW),
 * and auto-approved only when the vetting is confident and clean.
 */
class ApplicationService
{
    /**
     * @param AccountService $accounts Account creation
     * @param VettingService $vetting  Claude vetting
     */
    public function __construct(
        private readonly AccountService $accounts = new AccountService(),
        private readonly VettingService $vetting = new VettingService(),
    ) {
    }

    /**
     * Handles a new application.
     *
     * @param array<string, mixed> $input     { email, password, role, dob, application_data }
     * @param string|null          $ipAddress Client IP
     * @return array<string, mixed> { status, message, token?, profile? }
     * @throws ApiException 422 invalid / under 18, 409 existing account, 429 too many today
     */
    public function submit(array $input, ?string $ipAddress): array
    {
        $this->validate($input);
        $email = strtolower(trim((string) $input['email']));
        $this->guardLimits($email);

        $vet = $this->vetting->vet([
            'email'            => $email,
            'role'             => (string) $input['role'],
            'dob'              => (string) $input['dob'],
            'age'              => Format::age((string) $input['dob']),
            'application_data' => $input['application_data'],
        ]);

        $row = [
            'email'            => $email,
            'requested_role'   => (string) $input['role'],
            'dob'              => (string) $input['dob'],
            'application_data' => (string) json_encode($input['application_data'], JSON_UNESCAPED_UNICODE),
            'ai_decision'      => $vet['decision'],
            'ai_confidence'    => number_format($vet['confidence'], 2, '.', ''),
            'ai_reasoning'     => $vet['reasoning'],
            'ai_red_flags'     => (string) json_encode($vet['red_flags'], JSON_UNESCAPED_UNICODE),
            'ip_address'       => $ipAddress,
        ];

        if ($vet['decision'] === 'APPROVED') {
            return $this->approve($row, $input);
        }

        return $this->queue($row, $vet, (string) $input['password']);
    }

    /**
     * API shape of an application (admin views). Never includes password_hash.
     *
     * @param array<string, mixed> $a signup_applications row
     * @return array<string, mixed>
     */
    public static function format(array $a): array
    {
        $data = Format::jsonArray($a['application_data']);

        return [
            'id'               => (int) $a['id'],
            'email'            => $a['email'],
            'requested_role'   => $a['requested_role'],
            'dob'              => $a['dob'],
            'application_data' => $data === [] ? new \stdClass() : $data,
            'ai_decision'      => $a['ai_decision'],
            'ai_confidence'    => $a['ai_confidence'] === null ? null : (float) $a['ai_confidence'],
            'ai_reasoning'     => $a['ai_reasoning'],
            'ai_red_flags'     => array_values(Format::jsonArray($a['ai_red_flags'])),
            'admin_decision'   => $a['admin_decision'],
            'admin_notes'      => $a['admin_notes'],
            'status'           => $a['status'],
            'created_user_id'  => Format::intOrNull($a['created_user_id']),
            'reviewed_at'      => Format::iso($a['reviewed_at']),
            'created_at'       => Format::iso($a['created_at']),
        ];
    }

    /**
     * Stores an application row.
     *
     * @param array<string, mixed> $row Values
     * @return int New id
     */
    public static function store(array $row): int
    {
        $model = model(SignupApplicationModel::class);

        try {
            $id = $model->insert($row, true);

            if ($id === false) {
                throw new RuntimeException('Application insert failed: ' . implode(', ', $model->errors()));
            }

            return (int) $id;
        } catch (Throwable $e) {
            log_message('error', '[ApplicationService::store] ' . $e->getMessage());

            throw $e;
        }
    }

    /**
     * Creates the account for an AI-approved application; falls back to review on failure.
     *
     * @param array<string, mixed> $row   Application values
     * @param array<string, mixed> $input Request body
     * @return array<string, mixed>
     */
    private function approve(array $row, array $input): array
    {
        $firstName = InputValidator::optionalString((array) $input['application_data'], 'first_name')
            ?? explode('@', $row['email'])[0];

        try {
            $profile = $this->accounts->createAccount(
                ['email' => $row['email'], 'role' => $row['requested_role'], 'dob' => $row['dob'], 'first_name' => mb_substr($firstName, 0, 100)],
                (string) $input['password'],
            );
        } catch (RuntimeException $e) {
            log_message('error', '[ApplicationService::approve] ' . $e->getMessage());
            $row['ai_reasoning'] .= ' | Account creation failed; queued for review.';

            return $this->queue($row, ['decision' => 'NEEDS_REVIEW'], (string) $input['password']);
        }

        self::store($row + ['status' => 'APPROVED', 'created_user_id' => (int) $profile['user_id']]);

        return [
            'status'  => 'APPROVED',
            'message' => "Your account is ready. Welcome to Archie Learn!",
            'token'   => $this->accounts->issueToken((int) $profile['user_id']),
            'profile' => ProfileService::format($profile),
        ];
    }

    /**
     * Stores a NEEDS_REVIEW / REJECTED application.
     *
     * @param array<string, mixed> $row      Application values
     * @param array<string, mixed> $vet      Vetting result
     * @param string               $password Plain password (hashed and kept only for review)
     * @return array{status: string, message: string}
     */
    private function queue(array $row, array $vet, string $password): array
    {
        if ($vet['decision'] === 'NEEDS_REVIEW') {
            self::store($row + ['status' => 'NEEDS_REVIEW', 'password_hash' => service('passwords')->hash($password)]);

            return [
                'status'  => 'NEEDS_REVIEW',
                'message' => 'Thanks — our team will review your application and email you within 24 hours.',
            ];
        }

        self::store($row + ['status' => 'REJECTED']);

        return [
            'status'  => 'REJECTED',
            'message' => "We couldn't verify your application. Please check your details and apply again, or contact support.",
        ];
    }

    /**
     * Validates the application body.
     *
     * @param array<string, mixed> $input Request body
     * @throws ApiException 422
     */
    private function validate(array $input): void
    {
        InputValidator::check($input, [
            'email'    => 'required|valid_email|max_length[254]',
            'password' => 'required|min_length[8]|max_length[72]',
            'role'     => 'required|in_list[teacher,parent]',
            'dob'      => 'required|valid_date[Y-m-d]',
        ], AuthService::messages() + ['role' => ['in_list' => 'Role must be teacher or parent.']]);

        $data = $input['application_data'] ?? null;

        if (! is_array($data) || $data === [] || array_is_list($data) || strlen((string) json_encode($data)) > 16384) {
            throw ApiException::validation(['application_data' => 'Please complete the application form.']);
        }

        if (Format::age((string) $input['dob']) < 18) {
            throw new ApiException('Adult signup is for ages 18 and older. Please sign up as a student.', 422);
        }
    }

    /**
     * Enforces one account per email and the daily application limit.
     *
     * @param string $email Normalised email
     * @throws ApiException 409 / 429
     */
    private function guardLimits(string $email): void
    {
        if ($this->accounts->findUserByEmail($email) !== null) {
            throw new ApiException('An account with this email already exists.', 409);
        }

        $today = model(SignupApplicationModel::class)->where('email', $email)
            ->where('created_at >=', Format::now('-24 hours'))->countAllResults();

        if ($today >= config(Archie::class)->applicationsPerEmailPerDay) {
            throw new ApiException('Too many applications from this email today. Please try again tomorrow.', 429);
        }
    }
}
