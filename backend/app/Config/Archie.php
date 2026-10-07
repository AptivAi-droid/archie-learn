<?php

declare(strict_types=1);

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * Archie Learn application settings. Every value is read from `.env` (see .env.example).
 */
class Archie extends BaseConfig
{
    public string $apiVersion = '1';

    public string $anthropicApiKey  = '';
    public string $anthropicBaseUrl = 'https://api.anthropic.com';
    public string $tutorModel       = 'claude-sonnet-5-5';
    public string $vettingModel     = 'claude-sonnet-5-5';
    public string $markingModel     = 'claude-haiku-4-5';
    public int $claudeTimeout       = 60;

    /** Tutor chat messages per user per clock hour. */
    public int $chatRateLimit = 30;

    /** Practice answers marked per user per clock hour. */
    public int $markRateLimit = 60;

    /** Frontend base URL with trailing slash, used in password-reset links. */
    public string $frontendUrl = 'http://localhost:5173/';

    /** Access-token lifetime in days. */
    public int $tokenLifetimeDays = 30;

    /** Applications allowed per email address per 24 h. */
    public int $applicationsPerEmailPerDay = 3;

    /**
     * Per-IP throttle buckets for the Throttle filter: [capacity, seconds].
     *
     * @var array<string, array{0: int, 1: int}>
     */
    public array $throttle = [
        'auth'         => [10, MINUTE],
        'applications' => [5, MINUTE],
        'linking'      => [10, MINUTE],
    ];

    /**
     * Loads settings from the environment.
     */
    public function __construct()
    {
        parent::__construct();

        $this->anthropicApiKey   = (string) env('ANTHROPIC_API_KEY', $this->anthropicApiKey);
        $this->anthropicBaseUrl  = rtrim((string) env('ANTHROPIC_BASE_URL', $this->anthropicBaseUrl), '/');
        $this->claudeTimeout     = (int) env('CLAUDE_TIMEOUT', $this->claudeTimeout);
        $this->chatRateLimit     = (int) env('CHAT_RATE_LIMIT', $this->chatRateLimit);
        $this->markRateLimit     = (int) env('MARK_RATE_LIMIT', $this->markRateLimit);
        $this->tokenLifetimeDays = (int) env('TOKEN_LIFETIME_DAYS', $this->tokenLifetimeDays);
        $this->frontendUrl       = rtrim((string) env('FRONTEND_URL', $this->frontendUrl), '/') . '/';

        $authPerMinute = (int) env('THROTTLE_AUTH_PER_MINUTE', $this->throttle['auth'][0]);
        $this->throttle['auth'][0] = max(1, $authPerMinute);
    }
}
