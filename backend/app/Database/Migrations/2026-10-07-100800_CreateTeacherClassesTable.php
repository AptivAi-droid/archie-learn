<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use App\Database\ArchieMigration;

/**
 * Creates the `teacher_classes` table.
 */
class CreateTeacherClassesTable extends ArchieMigration
{
    /**
     * Applies the migration.
     */
    public function up(): void
    {
        $this->forge->addField($this->idField() + [
            'teacher_id' => $this->userIdColumn(),
            'name'       => ['type' => 'VARCHAR', 'constraint' => 100],
            'subject'    => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => true],
            'grade'      => ['type' => 'TINYINT', 'unsigned' => true, 'null' => true],
            'join_code'  => ['type' => 'CHAR', 'constraint' => 8],
        ] + $this->timestampFields());
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('join_code');
        $this->forge->addKey('teacher_id');
        $this->forge->addForeignKey('teacher_id', 'users', 'id', 'CASCADE', 'CASCADE', 'fk_teacher_classes_teacher');
        $this->createStandardTable('teacher_classes');
    }

    /**
     * Reverts the migration.
     */
    public function down(): void
    {
        $this->forge->dropTable('teacher_classes', true);
    }
}
