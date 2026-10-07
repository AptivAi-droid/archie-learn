<?php

declare(strict_types=1);

namespace App\Libraries;

use CodeIgniter\Database\BaseConnection;
use Config\Database;
use Throwable;

/**
 * Per-user, per-endpoint hourly request counter backed by `rate_limits`.
 *
 * The counter row for (user_id, endpoint, window_start) is created or incremented in a single
 * atomic statement, so concurrent requests can never both slip under the limit.
 */
class RateLimiter
{
    private BaseConnection $db;

    /**
     * @param BaseConnection|null $db Database connection (defaults to the default group)
     */
    public function __construct(?BaseConnection $db = null)
    {
        $this->db = $db ?? Database::connect();
    }

    /**
     * Counts this request and reports whether the caller is now over the limit.
     *
     * @param int    $userId   Authenticated user id
     * @param string $endpoint Logical endpoint name, e.g. 'chat'
     * @param int    $limit    Allowed requests per clock hour
     * @return bool True when this request exceeds the limit
     */
    public function hit(int $userId, string $endpoint, int $limit): bool
    {
        $window = gmdate('Y-m-d H:00:00');
        $now    = gmdate('Y-m-d H:i:s');
        $table  = $this->db->prefixTable('rate_limits');

        // Raw SQL on purpose: Query Builder cannot express INSERT … ON DUPLICATE KEY UPDATE
        // with an arithmetic increment, and the atomic upsert is what makes the limit race-free.
        // All values are bound, never interpolated.
        try {
            $this->db->query(
                'INSERT INTO ' . $this->db->escapeIdentifiers($table)
                . ' (user_id, endpoint, window_start, request_count, created_at, updated_at)'
                . ' VALUES (?, ?, ?, 1, ?, ?)'
                . ' ON DUPLICATE KEY UPDATE request_count = request_count + 1, updated_at = ?',
                [$userId, $endpoint, $window, $now, $now, $now],
            );
        } catch (Throwable $e) {
            log_message('error', '[RateLimiter::hit] ' . $e->getMessage());

            throw $e;
        }

        $row = $this->db->table('rate_limits')
            ->select('request_count')
            ->where(['user_id' => $userId, 'endpoint' => $endpoint, 'window_start' => $window])
            ->get()
            ->getRowArray();

        return (int) ($row['request_count'] ?? 0) > $limit;
    }
}
