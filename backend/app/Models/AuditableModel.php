<?php

declare(strict_types=1);

namespace App\Models;

use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\Model;
use Throwable;

/**
 * Base model for every domain table: writes an append-only audit_log row on each
 * insert, update and delete via CI4 model events (manifesto §7).
 *
 * Updates and deletes must be made by primary key (Model::update($id, …) /
 * Model::delete($id)) so the old values can be captured.
 */
abstract class AuditableModel extends Model
{
    protected $returnType     = 'array';
    protected $useTimestamps  = true;
    protected $dateFormat     = 'datetime';
    protected $createdField   = 'created_at';
    protected $updatedField   = 'updated_at';
    protected $protectFields  = true;
    protected $allowCallbacks = true;
    protected $beforeUpdate   = ['captureOldValues'];
    protected $beforeDelete   = ['captureOldValues'];
    protected $afterInsert    = ['logAuditInsert'];
    protected $afterUpdate    = ['logAuditUpdate'];
    protected $afterDelete    = ['logAuditDelete'];

    /**
     * Columns never copied into audit_log (secrets, hashes).
     *
     * @var list<string>
     */
    protected array $auditExclude = [];

    /**
     * Rows captured before an update/delete, keyed by primary key.
     *
     * @var array<string, array<string, mixed>>
     */
    private array $pendingOldValues = [];

    /**
     * Rows changed by the most recent update()/delete() on this model (read before the audit
     * insert runs, which would otherwise overwrite the connection's affected-row count).
     */
    private int $lastAffectedRows = 0;

    /**
     * Rows changed by the most recent update()/delete(). Used for conditional, race-free
     * "consume once" updates: $model->where('used_at', null)->update($id, …) then check === 1.
     */
    public function lastAffectedRows(): int
    {
        return $this->lastAffectedRows;
    }

    /**
     * Captures the current rows before they are changed.
     *
     * @param array<string, mixed> $data Event data
     * @return array<string, mixed>
     */
    protected function captureOldValues(array $data): array
    {
        $ids = $this->normaliseIds($data['id'] ?? null);
        $this->pendingOldValues = [];

        if ($ids === []) {
            return $data;
        }

        // A fresh builder so the model's pending update/delete query is not disturbed.
        $rows = $this->db->table($this->table)->whereIn($this->primaryKey, $ids)->get()->getResultArray();

        foreach ($rows as $row) {
            $this->pendingOldValues[(string) $row[$this->primaryKey]] = $row;
        }

        return $data;
    }

    /**
     * afterInsert callback.
     *
     * @param array<string, mixed> $data Event data
     * @return array<string, mixed>
     */
    protected function logAuditInsert(array $data): array
    {
        if (($data['result'] ?? false) !== false) {
            $this->logAudit('insert', (string) $data['id'], null, $data['data'] ?? []);
        }

        return $data;
    }

    /**
     * afterUpdate callback.
     *
     * @param array<string, mixed> $data Event data
     * @return array<string, mixed>
     */
    protected function logAuditUpdate(array $data): array
    {
        $this->lastAffectedRows = ($data['result'] ?? false) === false ? 0 : $this->db->affectedRows();

        // Nothing changed (failed, or a conditional update matched no row): nothing to audit.
        if ($this->lastAffectedRows === 0) {
            $this->pendingOldValues = [];

            return $data;
        }

        foreach ($this->normaliseIds($data['id'] ?? null) as $id) {
            $this->logAudit('update', (string) $id, $this->pendingOldValues[(string) $id] ?? null, $data['data'] ?? []);
        }

        $this->pendingOldValues = [];

        return $data;
    }

    /**
     * afterDelete callback.
     *
     * @param array<string, mixed> $data Event data
     * @return array<string, mixed>
     */
    protected function logAuditDelete(array $data): array
    {
        $this->lastAffectedRows = ($data['result'] ?? false) === false ? 0 : $this->db->affectedRows();

        // Nothing changed (failed, or a conditional update matched no row): nothing to audit.
        if ($this->lastAffectedRows === 0) {
            $this->pendingOldValues = [];

            return $data;
        }

        foreach ($this->normaliseIds($data['id'] ?? null) as $id) {
            $this->logAudit('delete', (string) $id, $this->pendingOldValues[(string) $id] ?? null, null);
        }

        $this->pendingOldValues = [];

        return $data;
    }

    /**
     * Writes one audit_log row. Audit failures are logged and re-thrown — the audit trail is
     * not optional.
     *
     * @param string                    $action   insert|update|delete
     * @param string                    $recordId Primary key of the affected row
     * @param array<string, mixed>|null $old      Previous values
     * @param array<string, mixed>|null $new      New values
     */
    private function logAudit(string $action, string $recordId, ?array $old, ?array $new): void
    {
        try {
            model(AuditLogModel::class)->record([
                'table_name' => $this->table,
                'record_id'  => $recordId,
                'action'     => $action,
                'old_values' => $this->encodeValues($old),
                'new_values' => $this->encodeValues($new),
                'user_id'    => $this->currentUserId(),
                'ip_address' => $this->requestValue('ip'),
                'user_agent' => $this->requestValue('agent'),
            ]);
        } catch (Throwable $e) {
            log_message('error', '[AuditableModel::logAudit] ' . $this->table . ' ' . $action . ': ' . $e->getMessage());

            throw $e;
        }
    }

    /**
     * JSON-encodes values with sensitive columns removed.
     *
     * @param array<string, mixed>|null $values Row values
     */
    private function encodeValues(?array $values): ?string
    {
        if ($values === null) {
            return null;
        }

        foreach ($this->auditExclude as $field) {
            if (array_key_exists($field, $values)) {
                $values[$field] = '[redacted]';
            }
        }

        return json_encode($values, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE) ?: null;
    }

    /**
     * The authenticated user's id, or null (CLI, anonymous routes).
     */
    private function currentUserId(): ?int
    {
        try {
            // getUser() only reads the user the ApiAuth filter resolved; it never triggers a
            // token lookup (Auth::id() would, and would log a failed attempt on public routes).
            $id = auth('tokens')->getAuthenticator()->getUser()?->id;

            return $id === null ? null : (int) $id;
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * Reads the client IP or user agent from the current HTTP request.
     *
     * @param string $what 'ip' or 'agent'
     */
    private function requestValue(string $what): ?string
    {
        $request = service('request');

        if (! $request instanceof IncomingRequest) {
            return null;
        }

        $value = $what === 'ip' ? $request->getIPAddress() : (string) $request->getUserAgent();

        return $value === '' ? null : mb_substr($value, 0, $what === 'ip' ? 45 : 255);
    }

    /**
     * Normalises the event id payload into a list of scalar ids.
     *
     * @param mixed $ids Event id payload
     * @return list<int|string>
     */
    private function normaliseIds(mixed $ids): array
    {
        if ($ids === null || $ids === '' || $ids === []) {
            return [];
        }

        return array_values(array_filter((array) $ids, static fn ($id): bool => is_int($id) || is_string($id)));
    }
}
