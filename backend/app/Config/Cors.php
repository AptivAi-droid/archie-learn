<?php

declare(strict_types=1);

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * Cross-Origin Resource Sharing (CORS) for the REST API.
 *
 * Applied to `api/*` in Config\Filters. Allowed origins come from `.env`:
 *   cors.allowedOrigins = https://aptivai-droid.github.io,http://localhost:5173
 *
 * The API uses bearer tokens, not cookies, so credentials are not allowed.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
 */
class Cors extends BaseConfig
{
    /**
     * @var array{
     *      allowedOrigins: list<string>,
     *      allowedOriginsPatterns: list<string>,
     *      supportsCredentials: bool,
     *      allowedHeaders: list<string>,
     *      exposedHeaders: list<string>,
     *      allowedMethods: list<string>,
     *      maxAge: int,
     *  }
     */
    public array $default = [
        'allowedOrigins'         => [],
        'allowedOriginsPatterns' => [],
        'supportsCredentials'    => false,
        'allowedHeaders'         => ['Authorization', 'Content-Type', 'Accept'],
        'exposedHeaders'         => [],
        'allowedMethods'         => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        'maxAge'                 => 7200,
    ];

    /**
     * Reads the allowed origins from the environment.
     */
    public function __construct()
    {
        parent::__construct();

        $origins = (string) env('cors.allowedOrigins', 'http://localhost:5173');

        $this->default['allowedOrigins'] = array_values(array_filter(array_map(
            static fn (string $origin): string => rtrim(trim($origin), '/'),
            explode(',', $origins),
        ), static fn (string $origin): bool => $origin !== '' && $origin !== '*'));
    }
}
