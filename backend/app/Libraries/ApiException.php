<?php

declare(strict_types=1);

namespace App\Libraries;

use RuntimeException;

/**
 * A client-facing API error. Services throw it; Api\ApiController turns it into
 * `{ "error": message, "errors"?: {...}, ...extra }` with the given HTTP status.
 */
class ApiException extends RuntimeException
{
    /**
     * @param string                $message Learner-friendly message
     * @param int                   $status  HTTP status code
     * @param array<string, string> $errors  Field validation errors (422 only)
     * @param array<string, mixed>  $extra   Extra top-level body keys (e.g. ['code' => 'ADULT'])
     */
    public function __construct(
        string $message,
        private readonly int $status = 400,
        private readonly array $errors = [],
        private readonly array $extra = [],
    ) {
        parent::__construct($message);
    }

    /**
     * HTTP status code for the response.
     */
    public function getStatus(): int
    {
        return $this->status;
    }

    /**
     * Response body in the contract's error shape.
     *
     * @return array<string, mixed>
     */
    public function toBody(): array
    {
        $body = ['error' => $this->getMessage()];

        if ($this->errors !== []) {
            $body['errors'] = $this->errors;
        }

        return $body + $this->extra;
    }

    /**
     * Builds a 422 validation error.
     *
     * @param array<string, string> $errors Field => message
     */
    public static function validation(array $errors): self
    {
        $first = $errors === [] ? 'Please check your details.' : (string) reset($errors);

        return new self($first, 422, $errors);
    }
}
