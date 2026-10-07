<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use App\Database\ArchieMigration;

/**
 * Creates the `rate_limits` table.
 */
class CreateRateLimitsTable extends ArchieMigration
{
    /**
     * Applies the migration.
     */
    public function up(): void
    {
        $this->forge->addField($this->idField() + [
            'user_id'       => $this->userIdColumn(),
            'endpoint'      => ['type' => 'VARCHAR', 'constraint' => 50],
            'window_start'  => ['type' => 'DATETIME', 'null' => false],
            'request_count' => ['type' => 'INT', 'unsigned' => true, 'default' => 1],
        ] + $this->timestampFields());
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey(['user_id', 'endpoint', 'window_start'], 'uq_rate_limits_window');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE', 'fk_rate_limits_user');
        $this->createStandardTable('rate_limits');
    }

    /**
     * Reverts the migration.
     */
    public function down(): void
    {
        $this->forge->dropTable('rate_limits', true);
    }
}
