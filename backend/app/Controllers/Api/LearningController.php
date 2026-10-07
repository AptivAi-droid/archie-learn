<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Libraries\LearningService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Lesson views, progress and the companion buddy (students).
 */
class LearningController extends ApiController
{
    /**
     * POST /api/v1/lessons/views
     *
     * @return ResponseInterface JSON response
     */
    public function lessonView(): ResponseInterface
    {
        return $this->handle(function (): array {
            (new LearningService())->recordLessonView($this->userId(), $this->body());

            return [['ok' => true], 201];
        });
    }

    /**
     * GET /api/v1/progress
     *
     * @return ResponseInterface JSON response
     */
    public function progress(): ResponseInterface
    {
        return $this->handle(fn (): array => [(new LearningService())->progress($this->userId())]);
    }

    /**
     * GET /api/v1/buddy
     *
     * @return ResponseInterface JSON response
     */
    public function buddy(): ResponseInterface
    {
        return $this->handle(fn (): array => [(new LearningService())->buddy($this->userId())]);
    }

    /**
     * PUT /api/v1/buddy
     *
     * @return ResponseInterface JSON response
     */
    public function saveBuddy(): ResponseInterface
    {
        return $this->handle(fn (): array => [(new LearningService())->saveBuddy($this->userId(), $this->body())]);
    }
}
