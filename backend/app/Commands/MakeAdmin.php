<?php

declare(strict_types=1);

namespace App\Commands;

use App\Libraries\AccountService;
use App\Models\ProfileModel;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use Throwable;

/**
 * Promotes an existing account to admin. Admin can never be self-registered.
 *
 * Usage: php spark archie:make-admin someone@example.co.za
 */
class MakeAdmin extends BaseCommand
{
    protected $group       = 'Archie';
    protected $name        = 'archie:make-admin';
    protected $description = 'Promotes an existing user (by email) to the admin role.';
    protected $usage       = 'archie:make-admin <email>';
    protected $arguments   = ['email' => 'Email address of an existing account'];

    /**
     * Runs the command.
     *
     * @param array<int|string, string> $params CLI arguments
     * @return int Exit code (0 success, 1 failure)
     */
    public function run(array $params): int
    {
        $email = trim((string) ($params[0] ?? ''));

        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            CLI::error('Usage: php spark archie:make-admin <email>');

            return EXIT_USER_INPUT;
        }

        $user = (new AccountService())->findUserByEmail($email);
        $model = model(ProfileModel::class);
        $profile = $user === null ? null : $model->where('user_id', (int) $user->id)->first();

        if ($profile === null) {
            CLI::error("No account found for {$email}.");

            return EXIT_ERROR;
        }

        try {
            if (! $model->update((int) $profile['id'], ['role' => 'admin'])) {
                CLI::error('Update failed: ' . implode(', ', $model->errors()));

                return EXIT_ERROR;
            }
        } catch (Throwable $e) {
            log_message('error', '[MakeAdmin] ' . $e->getMessage());
            CLI::error('Update failed: ' . $e->getMessage());

            return EXIT_ERROR;
        }

        CLI::write("{$email} is now an admin.", 'green');

        return EXIT_SUCCESS;
    }
}
