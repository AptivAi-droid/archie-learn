<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use App\Database\ArchieMigration;

/**
 * Creates the `feedback` table.
 */
class CreateFeedbackTable extends ArchieMigration
{
    /**
     * Applies the migration.
     */
    public function up(): void
    {
        $this->forge->addField($this->idField() + [
            'user_id'         => $this->userIdColumn(),
            'session_id'      => $this->bigFkColumn(true),
            'rating'          => ['type' => 'TINYINT', 'unsigned' => true],
            'what_worked'     => ['type' => 'TEXT', 'null' => true],
            'what_frustrated' => ['type' => 'TEXT', 'null' => true],
        ] + $this->timestampFields());
        $this->forge->addKey('id', true);
        $this->forge->addKey('user_id');
        $this->forge->addKey('created_at');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE', 'fk_feedback_user');
        $this->forge->addForeignKey('session_id', 'chat_sessions', 'id', 'CASCADE', 'SET NULL', 'fk_feedback_session');
        $this->createStandardTable('feedback');
    }

    /**
     * Reverts the migration.
     */
    public function down(): void
    {
        $this->forge->dropTable('feedback', true);
    }
}
