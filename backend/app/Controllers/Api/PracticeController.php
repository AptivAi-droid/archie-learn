<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Libraries\PracticeService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Practice questions and AI marking (students).
 */
class PracticeController extends ApiController
{
    /**
     * GET /api/v1/practice/questions?subject=&grade=&limit=
     *
     * @return ResponseInterface JSON response
     */
    public function questions(): ResponseInterface
    {
        return $this->handle(fn (): array => [(new PracticeService())->questions((array) $this->request->getGet())]);
    }

    /**
     * POST /api/v1/practice/answers
     *
     * @return ResponseInterface JSON response
     */
    public function answer(): ResponseInterface
    {
        return $this->handle(fn (): array => [(new PracticeService())->answer($this->userId(), $this->body())]);
    }
}
