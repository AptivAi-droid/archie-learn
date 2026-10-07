<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Libraries\ClassService;
use App\Libraries\ProfileService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * The caller's own profile and class memberships.
 */
class MeController extends ApiController
{
    /**
     * GET /api/v1/me
     *
     * @return ResponseInterface JSON response
     */
    public function profile(): ResponseInterface
    {
        return $this->handle(fn (): array => [['profile' => (new ProfileService())->get($this->userId())]]);
    }

    /**
     * PUT /api/v1/me/profile — role and email are not writable.
     *
     * @return ResponseInterface JSON response
     */
    public function updateProfile(): ResponseInterface
    {
        return $this->handle(fn (): array => [['profile' => (new ProfileService())->update($this->userId(), $this->body())]]);
    }

    /**
     * GET /api/v1/me/classes (student)
     *
     * @return ResponseInterface JSON response
     */
    public function classes(): ResponseInterface
    {
        return $this->handle(fn (): array => [(new ClassService())->listForStudent($this->userId())]);
    }

    /**
     * DELETE /api/v1/me/classes/{id} (student)
     *
     * @param int $id Class id
     * @return ResponseInterface JSON response
     */
    public function leaveClass(int $id): ResponseInterface
    {
        return $this->handle(function () use ($id): array {
            (new ClassService())->leave($this->userId(), $id);

            return [['ok' => true]];
        });
    }
}
