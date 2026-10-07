<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Models\PasswordResetModel;
use CodeIgniter\Shield\Entities\User;
use Config\Archie;
use Config\Email as EmailConfig;
use RuntimeException;
use Throwable;

/**
 * Forgot / reset password. Tokens are 64 hex chars, stored only as a SHA-256 hash,
 * valid for 60 minutes and single use. Responses never reveal whether an email exists.
 */
class PasswordResetService
{
    private const INVALID = 'This reset link is invalid or has expired.';

    /**
     * @param AccountService $accounts Account lookup / password writes
     */
    public function __construct(private readonly AccountService $accounts = new AccountService())
    {
    }

    /**
     * Starts a reset for the email if an account exists (silently does nothing otherwise).
     *
     * @param array<string, mixed> $input { email }
     * @throws ApiException 422 when the email is malformed
     */
    public function forgot(array $input): void
    {
        InputValidator::check($input, ['email' => 'required|valid_email|max_length[254]'], AuthService::messages());

        $user = $this->accounts->findUserByEmail((string) $input['email']);

        if ($user === null) {
            return;
        }

        $token = bin2hex(random_bytes(32));
        $this->storeToken((int) $user->id, $token);
        $this->sendLink((string) $user->email, $token);
    }

    /**
     * Completes a reset: sets the new password, consumes the token, revokes all tokens.
     *
     * @param array<string, mixed> $input { token, password }
     * @throws ApiException 422 invalid password, 400 invalid/expired/used token
     */
    public function reset(array $input): void
    {
        InputValidator::check($input, [
            'token'    => 'required|max_length[128]',
            'password' => 'required|min_length[8]|max_length[72]',
        ], AuthService::messages());

        $model = model(PasswordResetModel::class);
        $row   = $model->where('token_hash', hash('sha256', (string) $input['token']))
            ->where('used_at', null)
            ->where('expires_at >', Format::now())
            ->first();

        if ($row === null) {
            throw new ApiException(self::INVALID, 400);
        }

        /** @var User|null $user */
        $user = auth()->getProvider()->findById((int) $row['user_id']);

        if ($user === null) {
            throw new ApiException(self::INVALID, 400);
        }

        $this->accounts->setPassword($user, (string) $input['password']);
        $this->markUsed($model, (int) $row['id']);
        $user->revokeAllAccessTokens();
    }

    /**
     * Replaces any open reset tokens for the user with a new one.
     *
     * @param int    $userId User id
     * @param string $token  Raw token (only its hash is stored)
     * @throws RuntimeException When the insert fails
     */
    private function storeToken(int $userId, string $token): void
    {
        $model = model(PasswordResetModel::class);

        try {
            foreach ($model->where('user_id', $userId)->where('used_at', null)->findAll() as $open) {
                $model->delete((int) $open['id']);
            }

            $ok = $model->insert([
                'user_id'    => $userId,
                'token_hash' => hash('sha256', $token),
                'expires_at' => Format::now('+60 minutes'),
            ]);

            if ($ok === false) {
                throw new RuntimeException('Reset token insert failed: ' . implode(', ', $model->errors()));
            }
        } catch (Throwable $e) {
            log_message('error', '[PasswordResetService::storeToken] ' . $e->getMessage());

            throw $e;
        }
    }

    /**
     * Marks a reset token used.
     *
     * @param PasswordResetModel $model Model
     * @param int                $id    password_resets.id
     */
    private function markUsed(PasswordResetModel $model, int $id): void
    {
        if (! $model->update($id, ['used_at' => Format::now()])) {
            log_message('error', '[PasswordResetService::markUsed] ' . implode(', ', $model->errors()));

            throw new RuntimeException('Could not consume reset token.');
        }
    }

    /**
     * Emails the reset link, or logs it in development when email is not configured.
     *
     * @param string $email Recipient
     * @param string $token Raw token
     */
    private function sendLink(string $email, string $token): void
    {
        $link   = config(Archie::class)->frontendUrl . 'reset-password?token=' . $token;
        $config = config(EmailConfig::class);

        if ($config->fromEmail === '') {
            if (ENVIRONMENT === 'development') {
                log_message('info', '[PasswordResetService] Email not configured. Reset link for {email}: {link}', ['email' => $email, 'link' => $link]);
            } else {
                log_message('warning', '[PasswordResetService] Email not configured; reset link not sent.');
            }

            return;
        }

        $mailer = service('email');
        $mailer->setFrom($config->fromEmail, $config->fromName !== '' ? $config->fromName : 'Archie Learn');
        $mailer->setTo($email);
        $mailer->setSubject('Reset your Archie Learn password');
        $mailer->setMessage(
            "Hi!\n\nSomeone asked to reset the password for your Archie Learn account.\n\n"
            . "Reset it here (the link works once, for 60 minutes):\n{unwrap}{$link}{/unwrap}\n\n"
            . "If this wasn't you, you can ignore this email.\n",
        );

        if (! $mailer->send(false)) {
            log_message('error', '[PasswordResetService::sendLink] ' . $mailer->printDebugger(['headers']));
        }
    }
}
