<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Libraries\Claude\ClaudeException;
use App\Libraries\ClaudeClient;
use CodeIgniter\HTTP\URI;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\Mock\MockCURLRequest;
use Config\App;
use Config\Archie;

/**
 * Request shape and response parsing of the raw-HTTP Claude client (no network).
 *
 * @internal
 */
final class ClaudeClientTest extends CIUnitTestCase
{
    private function client(string $output): array
    {
        $config                  = new Archie();
        $config->anthropicApiKey = 'sk-test';
        $http                    = new MockCURLRequest(config(App::class), new URI('https://api.anthropic.com/'), null, []);
        $http->setOutput($output);

        return [new ClaudeClient($config, $http), $http];
    }

    public function testSonnetRequestSkipsThinkingBlockAndOptsIntoFallback(): void
    {
        [$client, $http] = $this->client((string) json_encode([
            'content'     => [['type' => 'thinking', 'thinking' => ''], ['type' => 'text', 'text' => 'Hello learner']],
            'stop_reason' => 'end_turn',
        ]));

        $response = $client->message('claude-sonnet-5-5', 'sys', [['role' => 'user', 'content' => 'hi']], 4096, 'low');

        $this->assertSame('Hello learner', $response->text);
        $this->assertFalse($response->isRefusal());

        $headers = implode("\n", $http->curl_options[CURLOPT_HTTPHEADER]);
        $this->assertStringContainsString('anthropic-beta: server-side-fallback-2026-07-01', $headers);
        $this->assertStringContainsString('anthropic-version: 2023-06-01', $headers);
        $this->assertStringContainsString('x-api-key: sk-test', $headers);

        $body = json_decode($http->curl_options[CURLOPT_POSTFIELDS], true);
        $this->assertSame('default', $body['fallbacks']);
        $this->assertSame(['effort' => 'low'], $body['output_config']);
        $this->assertSame(4096, $body['max_tokens']);
    }

    public function testHaikuRequestHasNoFallbackOrEffort(): void
    {
        [$client, $http] = $this->client((string) json_encode(['content' => [['type' => 'text', 'text' => '{}']], 'stop_reason' => 'end_turn']));

        $client->message('claude-haiku-4-5', 'sys', [['role' => 'user', 'content' => 'mark']], 1024);

        $body = json_decode($http->curl_options[CURLOPT_POSTFIELDS], true);
        $this->assertArrayNotHasKey('fallbacks', $body);
        $this->assertArrayNotHasKey('output_config', $body);
        $this->assertStringNotContainsString('anthropic-beta', implode("\n", $http->curl_options[CURLOPT_HTTPHEADER]));
    }

    public function testRefusalIsReported(): void
    {
        [$client] = $this->client((string) json_encode(['content' => [], 'stop_reason' => 'refusal']));

        $this->assertTrue($client->message('claude-sonnet-5-5', 's', [['role' => 'user', 'content' => 'x']], 10)->isRefusal());
    }

    public function testMaxTokensWithoutTextThrows(): void
    {
        [$client] = $this->client((string) json_encode(['content' => [['type' => 'thinking', 'thinking' => '']], 'stop_reason' => 'max_tokens']));

        $this->expectException(ClaudeException::class);
        $client->message('claude-sonnet-5-5', 's', [['role' => 'user', 'content' => 'x']], 10);
    }

    public function testHttpErrorThrows(): void
    {
        [$client] = $this->client("HTTP/1.1 529 Overloaded\r\nContent-Type: application/json\r\n\r\n{\"type\":\"error\"}");

        $this->expectException(ClaudeException::class);
        $client->message('claude-sonnet-5-5', 's', [['role' => 'user', 'content' => 'x']], 10);
    }
}
