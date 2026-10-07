<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Models\ProfileModel;
use CodeIgniter\Database\BaseConnection;
use CodeIgniter\I18n\Time;
use CodeIgniter\Shield\Entities\User;
use CodeIgniter\Shield\Models\UserIdentityModel;
use CodeIgniter\Shield\Models\UserModel;
use Config\Archie;
use Config\Database;
use RuntimeException;
use Throwable;

/**
 * Creates and looks up accounts: a Shield user (credentials) plus its 1:1 profile
 * (role + learner details). Shared by registration, applications and admin approval.
 */
class AccountService
{
    private BaseConnection $db;

    /**
     * @param BaseConnection|null $db Database connection
     */
    public function __construct(?BaseConnection $db = null)
    {
        $this->db = $db ?? Database::connect();
    }

    /**
     * Finds a user by email (case-insensitive).
     *
     * @param string $email Email address
     */
    public function findUserByEmail(string $email): ?User
    {
        return $this->users()->findByCredentials(['email' => strtolower(trim($email))]);
    }

    /**
     * Creates a user + profile atomically.
     *
     * @param array{email: string, role: string, dob: ?string, first_name?: ?string} $profile Profile values
     * @param string|null $password     Plain password (hashed by Shield), or null when $passwordHash is given
     * @param string|null $passwordHash Pre-computed Shield password hash (admin-approved applications)
     * @return array<string, mixed> The stored profile row
     * @throws ApiException 409 when the email is already registered
     * @throws RuntimeException When a write fails
     */
    public function createAccount(array $profile, ?string $password, ?string $passwordHash = null): array
    {
        $email = strtolower(trim($profile['email']));

        if ($this->findUserByEmail($email) !== null) {
            throw new ApiException('An account with this email already exists.', 409);
        }

        $this->db->transException(true)->transStart();

        try {
            $userId = $this->insertUser($email, $password, $passwordHash);
            $row    = $this->insertProfile($userId, $email, $profile);
            $this->db->transComplete();

            return $row;
        } catch (Throwable $e) {
            $this->db->transRollback();
            log_message('error', '[AccountService::createAccount] ' . $e->getMessage());

            throw $e instanceof ApiException ? $e : new RuntimeException('Account creation failed.', 0, $e);
        }
    }

    /**
     * Issues a new access token for the user.
     *
     * @param int $userId Shield user id
     * @return string The raw bearer token (shown to the client once)
     */
    public function issueToken(int $userId): string
    {
        $user = $this->users()->findById($userId);

        if ($user === null) {
            throw new RuntimeException('User not found for token issue.');
        }

        $days = config(Archie::class)->tokenLifetimeDays;

        return $user->generateAccessToken('archie-web', ['*'], Time::now()->addDays($days))->raw_token;
    }

    /**
     * Replaces the user's password hash.
     *
     * @param User   $user     Shield user
     * @param string $password New plain password
     * @throws RuntimeException When the identity is missing or the write fails
     */
    public function setPassword(User $user, string $password): void
    {
        $identity = $user->getEmailIdentity();

        if ($identity === null) {
            throw new RuntimeException('User has no email identity.');
        }

        $identity->secret2 = service('passwords')->hash($password);

        if (! model(UserIdentityModel::class)->save($identity)) {
            throw new RuntimeException('Password update failed.');
        }
    }

    /**
     * Inserts the Shield user and its email/password identity.
     *
     * @param string      $email        Email
     * @param string|null $password     Plain password
     * @param string|null $passwordHash Pre-hashed password
     * @return int New user id
     */
    private function insertUser(string $email, ?string $password, ?string $passwordHash): int
    {
        $user = new User(['active' => 1]);
        $user->setEmail($email);

        if ($password !== null) {
            $user->setPassword($password);
        } elseif ($passwordHash !== null) {
            $user->setPasswordHash($passwordHash);
        } else {
            throw new RuntimeException('A password or password hash is required.');
        }

        $id = $this->users()->insert($user, true);

        if ($id === false) {
            throw new RuntimeException('User insert failed.');
        }

        return (int) $id;
    }

    /**
     * Inserts the profile row for a new user.
     *
     * @param int                  $userId  Shield user id
     * @param string               $email   Email copy
     * @param array<string, mixed> $profile Profile values
     * @return array<string, mixed> Stored row
     */
    private function insertProfile(int $userId, string $email, array $profile): array
    {
        $model = model(ProfileModel::class);
        $id    = $model->insert([
            'user_id'    => $userId,
            'email'      => $email,
            'role'       => $profile['role'],
            'dob'        => $profile['dob'] ?? null,
            'first_name' => $profile['first_name'] ?? null,
        ], true);

        if ($id === false) {
            throw new RuntimeException('Profile insert failed: ' . implode(', ', $model->errors()));
        }

        return $model->find($id);
    }

    /**
     * Shield's user provider.
     */
    private function users(): UserModel
    {
        /** @var UserModel $provider */
        $provider = auth()->getProvider();

        return $provider;
    }
}
