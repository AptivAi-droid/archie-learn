<?php

declare(strict_types=1);

namespace App\Libraries\Claude;

/**
 * Contract for calling the Claude Messages API. The real implementation is
 * App\Libraries\ClaudeClient; tests inject a fake via Services::injectMock('claude', $fake).
 */
interface ClaudeClientInterface
{
    /**
     * Sends one Messages API request.
     *
     * @param string                                                $model     Model id, e.g. claude-sonnet-5-5
     * @param string                                                $system    System prompt
     * @param list<array{role: 'user'|'assistant', content: string}> $messages Conversation, starting with a user turn
     * @param int                                                   $maxTokens max_tokens
     * @param string|null                                           $effort    output_config.effort (null = model default)
     * @return ClaudeResponse Text + stop reason (check isRefusal() first)
     * @throws ClaudeException When no usable response was obtained
     */
    public function message(string $model, string $system, array $messages, int $maxTokens, ?string $effort = null): ClaudeResponse;
}
