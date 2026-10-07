<?php

declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;
use LogicException;
use RuntimeException;

/**
 * Append-only audit trail (manifesto §7). The application can only INSERT and SELECT;
 * every mutating method throws. Production also enforces this with a MySQL GRANT of
 * SELECT, INSERT only on `audit_log` for the application user.
 */
class AuditLogModel extends Model
{
    protected $table          = 'audit_log';
    protected $primaryKey     = 'id';
    protected $returnType     = 'array';
    protected $useTimestamps  = true;
    protected $dateFormat     = 'datetime';
    protected $protectFields  = true;
    protected $allowedFields  = [
        'table_name', 'record_id', 'action', 'old_values', 'new_values', 'user_id', 'ip_address', 'user_agent',
    ];
    protected $validationRules = [
        'table_name' => 'required|max_length[64]',
        'record_id'  => 'permit_empty|max_length[64]',
        'action'     => 'required|in_list[insert,update,delete]',
        'old_values' => 'permit_empty|valid_json',
        'new_values' => 'permit_empty|valid_json',
        'user_id'    => 'permit_empty|is_natural_no_zero',
        'ip_address' => 'permit_empty|max_length[45]',
        'user_agent' => 'permit_empty|max_length[255]',
    ];
    protected $validationMessages = [
        'action' => ['in_list' => 'Audit action must be insert, update or delete.'],
    ];

    /**
     * Appends one audit row.
     *
     * @param array<string, mixed> $row Audit values (see $allowedFields)
     * @return int The new audit_log id
     * @throws RuntimeException If the insert fails validation or the database rejects it
     */
    public function record(array $row): int
    {
        $id = $this->insert($row, true);

        if ($id === false) {
            throw new RuntimeException('Audit insert failed: ' . implode(', ', $this->errors()));
        }

        return (int) $id;
    }

    /**
     * Audit rows are immutable.
     *
     * @param mixed $id  Ignored
     * @param mixed $row Ignored
     * @throws LogicException Always
     */
    public function update($id = null, $row = null): bool
    {
        throw new LogicException('audit_log is append-only: updates are not permitted.');
    }

    /**
     * Audit rows are immutable.
     *
     * @param array<int, mixed>|null $set       Ignored
     * @param string|null            $index     Ignored
     * @param int                    $batchSize Ignored
     * @param bool                   $returnSQL Ignored
     * @throws LogicException Always
     */
    public function updateBatch(?array $set = null, ?string $index = null, int $batchSize = 100, bool $returnSQL = false)
    {
        throw new LogicException('audit_log is append-only: updates are not permitted.');
    }

    /**
     * Audit rows can never be deleted.
     *
     * @param mixed $id    Ignored
     * @param bool  $purge Ignored
     * @throws LogicException Always
     */
    public function delete($id = null, bool $purge = false)
    {
        throw new LogicException('audit_log is append-only: deletes are not permitted.');
    }

    /**
     * REPLACE would overwrite audit rows.
     *
     * @param array<string, mixed>|null $row       Ignored
     * @param bool                      $returnSQL Ignored
     * @throws LogicException Always
     */
    public function replace(?array $row = null, bool $returnSQL = false)
    {
        throw new LogicException('audit_log is append-only: replace is not permitted.');
    }

    /**
     * Audit rows are never purged.
     *
     * @throws LogicException Always
     */
    public function purgeDeleted()
    {
        throw new LogicException('audit_log is append-only: purge is not permitted.');
    }
}
