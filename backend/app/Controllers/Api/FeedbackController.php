<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Libraries\FeedbackService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * In-app feedback (any role).
 */
class FeedbackController extends ApiController
{
    /**
     * POST /api/v1/feedback
     *
     * @return ResponseInterface JSON response
     */
    public function create(): ResponseInterface
    {
        return $this->handle(function (): array {
            (new FeedbackService())->create($this->userId(), $this->body());

            return [['ok' => true], 201];
        });
    }
}
