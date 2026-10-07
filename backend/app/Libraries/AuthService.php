<?php

declare(strict_types=1);

namespace App\Libraries;

use CodeIgniter\Shield\Entities\User;

/**
 * Student registration, login, logout and password change.
 */
class AuthService
{
    /**
     * @param AccountService $accounts Account creation / lookup
     * @param ProfileService $profiles Profile formatting
     */
    public function __construct(
        private readonly AccountService $accounts = new AccountService(),
        private readonly ProfileService $profiles = new ProfileService(),
    ) {
    }

    /**
     * Registers a student (ages 13–17). Adults are routed to /applications.
     *
     * @param array<string, mixed> $input { email, password, dob }
     * @return array{token: string, profile: array<string, mixed>}
     * @throws ApiException 422 invalid / under 13 / adult (code ADULT), 409 duplicate email
     */
    public function register(array $input): array
    {
        InputValidator::check($input, [
            'email'    => 'required|valid_email|max_length[254]',
            'password' => 'required|min_length[8]|max_length[72]',
            'dob'      => 'required|valid_date[Y-m-d]',
        ], self::messages());

        $age = Format::age((string) $input['dob']);

        if ($age < 13) {
            throw new ApiException('Archie is for learners aged 13 and up.', 422);
        }

        if ($age >= 18) {
            throw new ApiException(
                'Adults sign up as a teacher or parent through an application.',
                422,
                [],
                ['code' => 'ADULT'],
            );
        }

        $row = $this->accounts->createAccount(
            ['email' => (string) $input['email'], 'role' => 'student', 'dob' => (string) $input['dob']],
            (string) $input['password'],
        );

        return [
            'token'   => $this->accounts->issueToken((int) $row['user_id']),
            'profile' => ProfileService::format($row),
        ];
    }

    /**
     * Logs a user in with email + password.
     *
     * @param array<string, mixed> $input { email, password }
     * @return array{token: string, profile: array<string, mixed>}
     * @throws ApiException 401 on bad credentials
     */
    public function login(array $input): array
    {
        $email    = is_string($input['email'] ?? null) ? $input['email'] : '';
        $password = is_string($input['password'] ?? null) ? $input['password'] : '';
        $user     = $email === '' ? null : $this->accounts->findUserByEmail($email);

        if ($user === null || $password === '' || ! $this->passwordMatches($user, $password)) {
            throw new ApiException("That email and password don't match.", 401);
        }

        return [
            'token'   => $this->accounts->issueToken((int) $user->id),
            'profile' => $this->profiles->get((int) $user->id),
        ];
    }

    /**
     * Revokes the access token used for this request.
     *
     * @param User   $user     Authenticated user
     * @param string $rawToken Bearer token from the Authorization header
     */
    public function logout(User $user, string $rawToken): void
    {
        $user->revokeAccessToken($rawToken);
    }

    /**
     * Changes the caller's password after verifying the current one.
     *
     * @param User                 $user  Authenticated user
     * @param array<string, mixed> $input { current_password, new_password }
     * @throws ApiException 422 invalid input, 400 wrong current password
     */
    public function changePassword(User $user, array $input): void
    {
        InputValidator::check($input, [
            'current_password' => 'required|max_length[72]',
            'new_password'     => 'required|min_length[8]|max_length[72]',
        ], self::messages());

        if (! $this->passwordMatches($user, (string) $input['current_password'])) {
            throw new ApiException('Your current password is not correct.', 400);
        }

        $this->accounts->setPassword($user, (string) $input['new_password']);
    }

    /**
     * Learner-friendly validation messages for auth forms.
     *
     * @return array<string, array<string, string>>
     */
    public static function messages(): array
    {
        $password = ['min_length' => 'Your password needs at least 8 characters.', 'max_length' => 'Your password is too long.'];

        return [
            'email'        => ['valid_email' => 'Please enter a valid email address.'],
            'password'     => $password,
            'new_password' => $password,
            'dob'          => ['valid_date' => 'Please enter your date of birth as YYYY-MM-DD.'],
        ];
    }

    /**
     * Verifies a password against the user's stored hash.
     *
     * @param User   $user     Shield user
     * @param string $password Plain password
     */
    private function passwordMatches(User $user, string $password): bool
    {
        $hash = $user->getPasswordHash();

        return $hash !== null && $hash !== '' && service('passwords')->verify($password, $hash);
    }
}
