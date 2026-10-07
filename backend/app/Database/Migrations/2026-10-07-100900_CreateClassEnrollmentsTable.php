<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use App\Database\ArchieMigration;

/**
 * Creates the `class_enrollments` table.
 */
class CreateClassEnrollmentsTable extends ArchieMigration
{
    /**
     * Applies the migration.
     */
    public function up(): void
    {
        $this->forge->addField($this->idField() + [
            'class_id'   => $this->bigFkColumn(),
            'student_id' => $this->userIdColumn(),
        ] + $this->timestampFields());
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey(['class_id', 'student_id']);
        $this->forge->addKey('student_id');
        $this->forge->addForeignKey('class_id', 'teacher_classes', 'id', 'CASCADE', 'CASCADE', 'fk_enrollments_class');
        $this->forge->addForeignKey('student_id', 'users', 'id', 'CASCADE', 'CASCADE', 'fk_enrollments_student');
        $this->createStandardTable('class_enrollments');
    }

    /**
     * Reverts the migration.
     */
    public function down(): void
    {
        $this->forge->dropTable('class_enrollments', true);
    }
}
