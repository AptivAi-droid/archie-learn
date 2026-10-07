<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Libraries\ApiException;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use CodeIgniter\Shield\Entities\User;
use Throwable;

/**
 * Base for all API controllers: JSON in/out, the contract's error shape, and the
 * authenticated user resolved by the `api-auth` filter. Controllers stay thin and
 * delegate to services in App\Libraries.
 */
abstract class ApiController extends ResourceController
{
    protected $format = 'json';

    /**
     * Runs a controller action, mapping ApiException to its status and anything else to 500.
     *
     * @param callable(): array{0: mixed, 1?: int} $action Returns [body, status?]
     */
    protected function handle(callable $action): ResponseInterface
    {
        try {
            $result = $action();

            return $this->json($result[0], $result[1] ?? 200);
        } catch (ApiException $e) {
            return $this->json($e->toBody(), $e->getStatus());
        } catch (Throwable $e) {
            log_message('error', '[' . static::class . '] ' . $e::class . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());

            return $this->json(['error' => 'Something went wrong on our side. Please try again.'], 500);
        }
    }

    /**
     * Sends a JSON response.
     *
     * @param mixed $body   Response body
     * @param int   $status HTTP status
     */
    protected function json(mixed $body, int $status = 200): ResponseInterface
    {
        return $this->response->setStatusCode($status)->setJSON($body);
    }

    /**
     * Decoded JSON request body (empty array when absent or invalid).
     *
     * @return array<string, mixed>
     */
    protected function body(): array
    {
        try {
            $data = $this->request->getJSON(true);
        } catch (Throwable) {
            return [];
        }

        return is_array($data) ? $data : [];
    }

    /**
     * The authenticated Shield user.
     *
     * @throws ApiException 401 when no user is resolved
     */
    protected function user(): User
    {
        $user = auth('tokens')->getAuthenticator()->getUser();

        if ($user === null) {
            throw new ApiException('Please log in again.', 401);
        }

        return $user;
    }

    /**
     * The authenticated user's id.
     *
     * @throws ApiException 401 when no user is resolved
     */
    protected function userId(): int
    {
        return (int) $this->user()->id;
    }
}
