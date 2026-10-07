<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Libraries\TutorService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Tutor chat (students).
 */
class ChatController extends ApiController
{
    /**
     * POST /api/v1/chat/messages
     *
     * @return ResponseInterface JSON response
     */
    public function send(): ResponseInterface
    {
        return $this->handle(fn (): array => [(new TutorService())->send($this->userId(), $this->body())]);
    }

    /**
     * GET /api/v1/chat/sessions/{id}/messages (owner only)
     *
     * @param int $id Session id
     * @return ResponseInterface JSON response
     */
    public function messages(int $id): ResponseInterface
    {
        return $this->handle(fn (): array => [(new TutorService())->messages($this->userId(), $id)]);
    }
}
