<?php

declare(strict_types=1);

namespace App\Libraries;

/**
 * Small, pure formatting helpers shared by services (dates, text sanitising, ages, JSON).
 */
final class Format
{
    /**
     * Converts a MySQL DATETIME (UTC) to ISO-8601, e.g. 2026-10-07T10:15:00Z.
     *
     * @param string|null $datetime 'Y-m-d H:i:s' or null
     */
    public static function iso(?string $datetime): ?string
    {
        if ($datetime === null || $datetime === '') {
            return null;
        }

        return str_replace(' ', 'T', substr($datetime, 0, 19)) . 'Z';
    }

    /**
     * Current UTC time as a MySQL DATETIME string.
     *
     * @param string $modifier Optional strtotime-style offset, e.g. '+60 minutes'
     */
    public static function now(string $modifier = ''): string
    {
        $time = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));

        return ($modifier === '' ? $time : $time->modify($modifier))->format('Y-m-d H:i:s');
    }

    /**
     * Strips HTML tags and control characters (keeps newlines and tabs), then trims.
     *
     * @param string $text Untrusted text
     */
    public static function cleanText(string $text): string
    {
        $text = strip_tags($text);
        $text = (string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $text);

        return trim($text);
    }

    /**
     * Age in whole years on today's date (UTC).
     *
     * @param string $dob Date of birth, Y-m-d
     */
    public static function age(string $dob): int
    {
        $birth = \DateTimeImmutable::createFromFormat('!Y-m-d', $dob, new \DateTimeZone('UTC'));

        if ($birth === false) {
            return 0;
        }

        return $birth->diff(new \DateTimeImmutable('today', new \DateTimeZone('UTC')))->y;
    }

    /**
     * Decodes a JSON column into an array (empty array on null/invalid).
     *
     * @param string|null $json Stored JSON
     * @return array<mixed>
     */
    public static function jsonArray(?string $json): array
    {
        if ($json === null || $json === '') {
            return [];
        }

        $decoded = json_decode($json, true);

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * Casts a nullable numeric DB value to int.
     *
     * @param mixed $value DB value
     */
    public static function intOrNull(mixed $value): ?int
    {
        return $value === null || $value === '' ? null : (int) $value;
    }

    /**
     * Random code from an unambiguous uppercase alphabet (no 0/O/1/I/L).
     *
     * @param int $length Code length
     */
    public static function randomCode(int $length): string
    {
        $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        $code     = '';

        for ($i = 0; $i < $length; $i++) {
            $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        return $code;
    }
}
