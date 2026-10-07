<?php

declare(strict_types=1);

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Archie;

/**
 * Per-IP token-bucket throttle (CI4 Throttler) for login, registration, password reset,
 * applications and code-entry endpoints. Buckets are configured in Config\Archie::$throttle.
 *
 * Usage in Routes.php: ['filter' => 'throttle:auth'].
 */
class ThrottleFilter implements FilterInterface
{
    /**
     * Returns 429 when the caller's IP has exhausted the bucket for this route.
     *
     * @param RequestInterface  $request   Current request
     * @param list<string>|null $arguments [bucket name]
     * @return ResponseInterface|null 429 response, or null to continue
     */
    public function before(RequestInterface $request, $arguments = null)
    {
        if (! $request instanceof IncomingRequest) {
            return null;
        }

        $bucket = (string) (($arguments ?? [])[0] ?? 'auth');
        [$capacity, $seconds] = config(Archie::class)->throttle[$bucket] ?? [10, MINUTE];

        // Cache keys may not contain reserved characters; hash IP + bucket + path.
        $key = 'throttle_' . md5($bucket . '|' . $request->getIPAddress() . '|' . $request->getPath());

        $throttler = service('throttler');

        if ($throttler->check($key, (int) $capacity, (int) $seconds)) {
            return null;
        }

        return service('response')
            ->setStatusCode(429)
            ->setHeader('Retry-After', (string) max(1, $throttler->getTokenTime()))
            ->setJSON(['error' => 'Too many attempts. Please wait a minute and try again.']);
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
}
