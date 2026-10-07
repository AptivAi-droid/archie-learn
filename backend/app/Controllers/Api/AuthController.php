<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Libraries\AuthService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Student registration, login and logout.
 */
class AuthController extends ApiController
{
    /**
     * POST /api/v1/auth/register — students aged 13–17.
     *
     * @return ResponseInterface JSON response
     */
    public function register(): ResponseInterface
    {
        return $this->handle(fn (): array => [(new AuthService())->register($this->body()), 201]);
    }

    /**
     * POST /api/v1/auth/login
     *
     * @return ResponseInterface JSON response
     */
    public function login(): ResponseInterface
    {
        return $this->handle(fn (): array => [(new AuthService())->login($this->body())]);
    }

    /**
     * POST /api/v1/auth/logout — revokes the current token.
     *
     * @return ResponseInterface JSON response
     */
    public function logout(): ResponseInterface
    {
        return $this->handle(function (): array {
            $raw = auth('tokens')->getAuthenticator()->getBearerToken() ?? '';
            (new AuthService())->logout($this->user(), $raw);

            return [['ok' => true]];
        });
    }
}
