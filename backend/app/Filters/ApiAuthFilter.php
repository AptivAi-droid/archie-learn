<?php

declare(strict_types=1);

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Authenticates API requests with a Shield access token (`Authorization: Bearer <token>`).
 *
 * Equivalent to Shield's TokenAuth filter but answers in the API's error format
 * (`{ "error": "…" }`) and clears any previously resolved user first, so a stale user can
 * never leak between requests handled by the same process.
 */
class ApiAuthFilter implements FilterInterface
{
    /**
     * Rejects the request with 401 unless a valid access token is presented.
     *
     * @param RequestInterface  $request   Current request
     * @param list<string>|null $arguments Unused
     * @return ResponseInterface|null 401 response, or null to continue
     */
    public function before(RequestInterface $request, $arguments = null)
    {
        if (! $request instanceof IncomingRequest) {
            return null;
        }

        $authenticator = auth('tokens')->getAuthenticator();
        $authenticator->logout();

        $header = $request->getHeaderLine('Authorization');

        if (! str_starts_with($header, 'Bearer ')) {
            return $this->unauthorised();
        }

        $result = $authenticator->attempt(['token' => $header]);

        if (! $result->isOK() || $authenticator->getUser() === null) {
            return $this->unauthorised();
        }

        $authenticator->recordActiveDate();

        return null;
    }

    /**
     * No post-processing.
     *
     * @param RequestInterface  $request   Current request
     * @param ResponseInterface $response  Current response
     * @param list<string>|null $arguments Unused
     */
    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null): void
    {
    }

    /**
     * Builds the 401 response on the shared response instance (keeps CORS headers).
     */
    private function unauthorised(): ResponseInterface
    {
        return service('response')
            ->setStatusCode(401)
            ->setJSON(['error' => 'Please log in again.']);
    }
}
