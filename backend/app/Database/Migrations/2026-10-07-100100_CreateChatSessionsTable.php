<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use App\Database\ArchieMigration;

/**
 * Creates the `chat_sessions` table.
 */
class CreateChatSessionsTable extends ArchieMigration
{
    /**
     * Applies the migration.
     */
    public function up(): void
    {
        $this->forge->addField($this->idField() + [
            'user_id' => $this->userIdColumn(),
            'subject' => ['type' => 'VARCHAR', 'constraint' => 100],
        ] + $this->timestampFields());
        $this->forge->addKey('id', true);
        $this->forge->addKey(['user_id', 'created_at']);
        $this->forge->addKey('created_at');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE', 'fk_chat_sessions_user');
        $this->createStandardTable('chat_sessions');
    }

    /**
     * Reverts the migration.
     */
    public function down(): void
    {
        $this->forge->dropTable('chat_sessions', true);
    }
}
