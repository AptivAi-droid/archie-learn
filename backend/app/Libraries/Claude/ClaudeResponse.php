<?php

declare(strict_types=1);

namespace App\Libraries\Claude;

/**
 * The parts of a Messages API response Archie uses.
 */
final class ClaudeResponse
{
    /**
     * @param string $text       Text of the first `text` content block ('' when refused)
     * @param string $stopReason API stop_reason (end_turn, max_tokens, refusal, …)
     */
    public function __construct(
        public readonly string $text,
        public readonly string $stopReason,
    ) {
    }

    /**
     * Whether the model's safety classifiers declined the request.
     */
    public function isRefusal(): bool
    {
        return $this->stopReason === 'refusal';
    }
}
