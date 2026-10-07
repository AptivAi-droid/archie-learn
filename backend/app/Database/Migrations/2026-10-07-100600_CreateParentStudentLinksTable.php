<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use App\Database\ArchieMigration;

/**
 * Creates the `parent_student_links` table.
 */
class CreateParentStudentLinksTable extends ArchieMigration
{
    /**
     * Applies the migration.
     */
    public function up(): void
    {
        $this->forge->addField($this->idField() + [
            'parent_id'  => $this->userIdColumn(),
            'student_id' => $this->userIdColumn(),
        ] + $this->timestampFields());
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey(['parent_id', 'student_id']);
        $this->forge->addKey('student_id');
        $this->forge->addForeignKey('parent_id', 'users', 'id', 'CASCADE', 'CASCADE', 'fk_psl_parent');
        $this->forge->addForeignKey('student_id', 'users', 'id', 'CASCADE', 'CASCADE', 'fk_psl_student');
        $this->createStandardTable('parent_student_links');
    }

    /**
     * Reverts the migration.
     */
    public function down(): void
    {
        $this->forge->dropTable('parent_student_links', true);
    }
}
