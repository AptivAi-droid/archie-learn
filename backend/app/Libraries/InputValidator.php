<?php

declare(strict_types=1);

namespace App\Libraries;

/**
 * Validates request input with CI4's validation service before any model write.
 */
final class InputValidator
{
    /**
     * Validates $data against $rules.
     *
     * @param array<string, mixed>                 $data     Input (decoded JSON body / query)
     * @param array<string, string>                $rules    CI4 rules
     * @param array<string, array<string, string>> $messages Custom messages
     * @throws ApiException 422 with field errors when invalid
     */
    public static function check(array $data, array $rules, array $messages = []): void
    {
        $validation = service('validation');
        $validation->reset();
        $validation->setRules($rules, $messages);

        if (! $validation->run($data)) {
            throw ApiException::validation($validation->getErrors());
        }
    }

    /**
     * Reads an optional trimmed string field from input.
     *
     * @param array<string, mixed> $data Input
     * @param string               $key  Field name
     */
    public static function optionalString(array $data, string $key): ?string
    {
        if (! array_key_exists($key, $data) || $data[$key] === null) {
            return null;
        }

        $value = is_scalar($data[$key]) ? Format::cleanText((string) $data[$key]) : '';

        return $value === '' ? null : $value;
    }
}
