<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Libraries\Claude\ClaudeClientInterface;
use App\Libraries\Claude\ClaudeException;
use App\Libraries\Claude\ClaudeResponse;

/**
 * Test double for the Claude client: returns queued responses (or throws queued failures)
 * and records every request so tests can assert on prompts.
 */
final class FakeClaudeClient implements ClaudeClientInterface
{
    /**
     * @var list<array{model: string, system: string, messages: list<array{role: string, content: string}>, maxTokens: int, effort: ?string}>
     */
    public array $calls = [];

    /**
     * @var list<ClaudeResponse|ClaudeException>
     */
    private array $queue = [];

    public string $defaultText = 'Nice! What do you think the first step is?';

    /**
     * Queues a normal text response.
     *
     * @param string $text Response text
     */
    public function queueText(string $text): self
    {
        $this->queue[] = new ClaudeResponse($text, 'end_turn');

        return $this;
    }

    /**
     * Queues a refusal (stop_reason = refusal).
     */
    public function queueRefusal(): self
    {
        $this->queue[] = new ClaudeResponse('', 'refusal');

        return $this;
    }

    /**
     * Queues a transport/API failure.
     */
    public function queueFailure(): self
    {
        $this->queue[] = new ClaudeException('Simulated Anthropic outage');

        return $this;
    }

    /**
     * {@inheritDoc}
     */
    public function message(string $model, string $system, array $messages, int $maxTokens, ?string $effort = null): ClaudeResponse
    {
        $this->calls[] = compact('model', 'system', 'messages', 'maxTokens', 'effort');
        $next          = array_shift($this->queue) ?? new ClaudeResponse($this->defaultText, 'end_turn');

        if ($next instanceof ClaudeException) {
            throw $next;
        }

        return $next;
    }

    /**
     * The most recent request.
     *
     * @return array{model: string, system: string, messages: list<array{role: string, content: string}>, maxTokens: int, effort: ?string}
     */
    public function lastCall(): array
    {
        return $this->calls[array_key_last($this->calls)];
    }
}
