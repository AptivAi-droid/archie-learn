<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Libraries\LinkService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Parent ↔ student linking.
 */
class LinkController extends ApiController
{
    /**
     * POST /api/v1/link-codes (student)
     *
     * @return ResponseInterface JSON response
     */
    public function createCode(): ResponseInterface
    {
        return $this->handle(fn (): array => [(new LinkService())->createCode($this->userId()), 201]);
    }

    /**
     * POST /api/v1/parent/links (parent)
     *
     * @return ResponseInterface JSON response
     */
    public function link(): ResponseInterface
    {
        return $this->handle(fn (): array => [(new LinkService())->linkParent($this->userId(), $this->body()), 201]);
    }

    /**
     * GET /api/v1/parent/students (parent)
     *
     * @return ResponseInterface JSON response
     */
    public function students(): ResponseInterface
    {
        return $this->handle(fn (): array => [(new LinkService())->students($this->userId())]);
    }

    /**
     * GET /api/v1/parent/students/{id}/activity (linked parent)
     *
     * @param int $id Student user id
     * @return ResponseInterface JSON response
     */
    public function activity(int $id): ResponseInterface
    {
        return $this->handle(fn (): array => [(new LinkService())->activity($this->userId(), $id)]);
    }
}
