<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use App\Database\ArchieMigration;

/**
 * Creates the `lesson_views` table.
 */
class CreateLessonViewsTable extends ArchieMigration
{
    /**
     * Applies the migration.
     */
    public function up(): void
    {
        $this->forge->addField($this->idField() + [
            'user_id'   => $this->userIdColumn(),
            'subject'   => ['type' => 'VARCHAR', 'constraint' => 100],
            'grade'     => ['type' => 'TINYINT', 'unsigned' => true],
            'topic_key' => ['type' => 'VARCHAR', 'constraint' => 255],
        ] + $this->timestampFields());
        $this->forge->addKey('id', true);
        $this->forge->addKey(['user_id', 'created_at']);
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE', 'fk_lesson_views_user');
        $this->createStandardTable('lesson_views');
    }

    /**
     * Reverts the migration.
     */
    public function down(): void
    {
        $this->forge->dropTable('lesson_views', true);
    }
}
