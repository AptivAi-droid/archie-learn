<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use CodeIgniter\HTTP\ResponseInterface;

/**
 * JSON fallbacks for unmatched routes (registered as the 404 override in Routes.php).
 */
class ErrorController extends ApiController
{
    /**
     * Unknown route → 404 in the contract's error shape.
     *
     * @param string|null $message Framework message (not exposed)
     * @return ResponseInterface JSON response
     */
    public function notFound(?string $message = null): ResponseInterface
    {
        return $this->json(['error' => 'Not found.'], 404);
    }
}
