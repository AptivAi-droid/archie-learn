<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Libraries\Claude\ClaudeClientInterface;
use App\Libraries\Claude\ClaudeException;
use App\Libraries\Claude\ClaudeResponse;
use CodeIgniter\HTTP\CURLRequest;
use Config\Archie;
use Throwable;

/**
 * Claude Messages API client over CI4's CURLRequest (raw HTTP; no SDK dependency).
 *
 * - Picks the first `text` content block: claude-sonnet-5-5 thinks by default, so the
 *   response content may start with a `thinking` block.
 * - claude-sonnet-5-5 requests opt into server-side refusal fallback
 *   (`anthropic-beta: server-side-fallback-2026-07-01`, body `fallbacks: "default"`).
 * - A `refusal` stop reason is returned to the caller (isRefusal()); `max_tokens` with no
 *   text, HTTP errors and timeouts throw ClaudeException.
 */
class ClaudeClient implements ClaudeClientInterface
{
    private const API_VERSION   = '2023-06-01';
    private const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

    /**
     * @param Archie           $config Archie settings (API key, base URL, timeout)
     * @param CURLRequest|null $http   HTTP client (defaults to a fresh CURLRequest)
     */
    public function __construct(
        private readonly Archie $config,
        private readonly ?CURLRequest $http = null,
    ) {
    }

    /**
     * {@inheritDoc}
     */
    public function message(string $model, string $system, array $messages, int $maxTokens, ?string $effort = null): ClaudeResponse
    {
        if ($this->config->anthropicApiKey === '') {
            throw new ClaudeException('ANTHROPIC_API_KEY is not configured.');
        }

        [$headers, $body] = $this->buildRequest($model, $system, $messages, $maxTokens, $effort);

        try {
            $response = ($this->http ?? single_service('curlrequest'))->post(
                $this->config->anthropicBaseUrl . '/v1/messages',
                [
                    'headers'     => $headers,
                    'body'        => json_encode($body, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                    'timeout'     => $this->config->claudeTimeout,
                    'http_errors' => false,
                ],
            );
        } catch (Throwable $e) {
            throw new ClaudeException('Anthropic request failed: ' . $e->getMessage(), 0, $e);
        }

        return $this->parse($response->getStatusCode(), (string) $response->getBody());
    }

    /**
     * Builds headers and JSON body.
     *
     * @param string                                   $model     Model id
     * @param string                                   $system    System prompt
     * @param list<array{role: string, content: string}> $messages Conversation
     * @param int                                      $maxTokens max_tokens
     * @param string|null                              $effort    output_config.effort
     * @return array{0: array<string, string>, 1: array<string, mixed>}
     */
    private function buildRequest(string $model, string $system, array $messages, int $maxTokens, ?string $effort): array
    {
        $headers = [
            'x-api-key'         => $this->config->anthropicApiKey,
            'anthropic-version' => self::API_VERSION,
            'content-type'      => 'application/json',
        ];
        $body = [
            'model'      => $model,
            'max_tokens' => $maxTokens,
            'system'     => $system,
            'messages'   => $messages,
        ];

        if ($effort !== null) {
            $body['output_config'] = ['effort' => $effort];
        }

        if (str_starts_with($model, 'claude-sonnet-5-5')) {
            $headers['anthropic-beta'] = self::FALLBACK_BETA;
            $body['fallbacks']         = 'default';
        }

        return [$headers, $body];
    }

    /**
     * Parses the HTTP response into a ClaudeResponse.
     *
     * @param int    $status HTTP status
     * @param string $raw    Response body
     * @throws ClaudeException On HTTP error, malformed body, or no text
     */
    private function parse(int $status, string $raw): ClaudeResponse
    {
        if ($status !== 200) {
            throw new ClaudeException('Anthropic HTTP ' . $status . ': ' . mb_substr($raw, 0, 500));
        }

        $data = json_decode($raw, true);

        if (! is_array($data)) {
            throw new ClaudeException('Anthropic returned a non-JSON body.');
        }

        $stopReason = (string) ($data['stop_reason'] ?? '');

        if ($stopReason === 'refusal') {
            return new ClaudeResponse('', 'refusal');
        }

        foreach ((array) ($data['content'] ?? []) as $block) {
            if (is_array($block) && ($block['type'] ?? null) === 'text' && trim((string) ($block['text'] ?? '')) !== '') {
                return new ClaudeResponse((string) $block['text'], $stopReason);
            }
        }

        throw new ClaudeException('Anthropic returned no text (stop_reason: ' . ($stopReason ?: 'unknown') . ').');
    }
}
