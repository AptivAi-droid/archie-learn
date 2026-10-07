<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Libraries\AdminService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Admin dashboard and application review.
 */
class AdminController extends ApiController
{
    /**
     * GET /api/v1/admin/overview
     *
     * @return ResponseInterface JSON response
     */
    public function overview(): ResponseInterface
    {
        return $this->handle(fn (): array => [(new AdminService())->overview()]);
    }

    /**
     * GET /api/v1/admin/sessions/{id}/messages
     *
     * @param int $id Session id
     * @return ResponseInterface JSON response
     */
    public function sessionMessages(int $id): ResponseInterface
    {
        return $this->handle(fn (): array => [(new AdminService())->sessionMessages($id)]);
    }

    /**
     * PUT /api/v1/admin/applications/{id}
     *
     * @param int $id Application id
     * @return ResponseInterface JSON response
     */
    public function decideApplication(int $id): ResponseInterface
    {
        return $this->handle(fn (): array => [(new AdminService())->decide($this->userId(), $id, $this->body())]);
    }
}
