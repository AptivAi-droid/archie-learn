<?php

declare(strict_types=1);

namespace App\Libraries\Claude;

use RuntimeException;

/**
 * Claude could not produce a usable answer (network/timeout, HTTP error, malformed body,
 * or no text before max_tokens). Callers map it to 502 or a fail-safe outcome.
 */
class ClaudeException extends RuntimeException
{
}
