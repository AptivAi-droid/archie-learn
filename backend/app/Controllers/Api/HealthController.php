<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use CodeIgniter\HTTP\ResponseInterface;
use Config\Archie;
use Config\Database;
use Throwable;

/**
 * Liveness + database connectivity check.
 */
class HealthController extends ApiController
{
    /**
     * GET /api/v1/health
     *
     * @return ResponseInterface JSON response
     */
    public function index(): ResponseInterface
    {
        $db = false;

        try {
            // Raw query on purpose: a trivial round-trip is the connectivity probe itself.
            $db = Database::connect()->query('SELECT 1') !== false;
        } catch (Throwable $e) {
            log_message('critical', '[HealthController] Database unreachable: ' . $e->getMessage());
        }

        return $this->json(['ok' => $db, 'db' => $db, 'version' => config(Archie::class)->apiVersion], $db ? 200 : 503);
    }
}
