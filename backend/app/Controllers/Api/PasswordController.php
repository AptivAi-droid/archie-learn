<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Libraries\AuthService;
use App\Libraries\PasswordResetService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Password change, forgot and reset.
 */
class PasswordController extends ApiController
{
    /**
     * PUT /api/v1/me/password
     *
     * @return ResponseInterface JSON response
     */
    public function change(): ResponseInterface
    {
        return $this->handle(function (): array {
            (new AuthService())->changePassword($this->user(), $this->body());

            return [['ok' => true]];
        });
    }

    /**
     * POST /api/v1/auth/password/forgot — always { ok: true } (no account enumeration).
     *
     * @return ResponseInterface JSON response
     */
    public function forgot(): ResponseInterface
    {
        return $this->handle(function (): array {
            (new PasswordResetService())->forgot($this->body());

            return [['ok' => true]];
        });
    }

    /**
     * POST /api/v1/auth/password/reset
     *
     * @return ResponseInterface JSON response
     */
    public function reset(): ResponseInterface
    {
        return $this->handle(function (): array {
            (new PasswordResetService())->reset($this->body());

            return [['ok' => true]];
        });
    }
}
