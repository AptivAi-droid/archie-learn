<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use App\Database\ArchieMigration;

/**
 * Creates the `link_codes` table.
 */
class CreateLinkCodesTable extends ArchieMigration
{
    /**
     * Applies the migration.
     */
    public function up(): void
    {
        $this->forge->addField($this->idField() + [
            'code'       => ['type' => 'CHAR', 'constraint' => 6],
            'student_id' => $this->userIdColumn(),
            'expires_at' => ['type' => 'DATETIME', 'null' => false],
            'used_at'    => ['type' => 'DATETIME', 'null' => true],
        ] + $this->timestampFields());
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('code');
        $this->forge->addKey('student_id');
        $this->forge->addForeignKey('student_id', 'users', 'id', 'CASCADE', 'CASCADE', 'fk_link_codes_student');
        $this->createStandardTable('link_codes');
    }

    /**
     * Reverts the migration.
     */
    public function down(): void
    {
        $this->forge->dropTable('link_codes', true);
    }
}
