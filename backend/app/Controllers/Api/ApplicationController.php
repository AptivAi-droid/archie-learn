<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Libraries\ApplicationService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Adult (teacher/parent) applications.
 */
class ApplicationController extends ApiController
{
    /**
     * POST /api/v1/applications
     *
     * @return ResponseInterface JSON response
     */
    public function create(): ResponseInterface
    {
        return $this->handle(fn (): array => [(new ApplicationService())->submit($this->body(), $this->request->getIPAddress())]);
    }
}
