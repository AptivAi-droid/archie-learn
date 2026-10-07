<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use App\Database\ArchieMigration;

/**
 * Creates the `audit_log` table.
 */
class CreateAuditLogTable extends ArchieMigration
{
    /**
     * Applies the migration.
     */
    public function up(): void
    {
        // Append-only. No FK on user_id on purpose: audit rows must outlive the rows they describe.
        // Production: GRANT SELECT, INSERT only on this table to the app user (see README).
        $this->forge->addField($this->idField() + [
            'table_name' => ['type' => 'VARCHAR', 'constraint' => 64],
            'record_id'  => ['type' => 'VARCHAR', 'constraint' => 64, 'null' => true],
            'action'     => ['type' => 'VARCHAR', 'constraint' => 10],
            'old_values' => ['type' => 'JSON', 'null' => true],
            'new_values' => ['type' => 'JSON', 'null' => true],
            'user_id'    => $this->userIdColumn(true),
            'ip_address' => ['type' => 'VARCHAR', 'constraint' => 45, 'null' => true],
            'user_agent' => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
        ] + $this->timestampFields());
        $this->forge->addKey('id', true);
        $this->forge->addKey(['table_name', 'record_id']);
        $this->forge->addKey('user_id');
        $this->forge->addKey('created_at');
        $this->createStandardTable('audit_log');
    }

    /**
     * Reverts the migration.
     */
    public function down(): void
    {
        $this->forge->dropTable('audit_log', true);
    }
}
