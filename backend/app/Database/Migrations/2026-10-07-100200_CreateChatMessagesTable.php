<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use App\Database\ArchieMigration;

/**
 * Creates the `chat_messages` table.
 */
class CreateChatMessagesTable extends ArchieMigration
{
    /**
     * Applies the migration.
     */
    public function up(): void
    {
        $this->forge->addField($this->idField() + [
            'session_id' => $this->bigFkColumn(),
            'user_id'    => $this->userIdColumn(),
            'role'       => ['type' => 'VARCHAR', 'constraint' => 10],
            'content'    => ['type' => 'TEXT'],
        ] + $this->timestampFields());
        $this->forge->addKey('id', true);
        $this->forge->addKey(['session_id', 'id']);
        $this->forge->addForeignKey('session_id', 'chat_sessions', 'id', 'CASCADE', 'CASCADE', 'fk_chat_messages_session');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE', 'fk_chat_messages_user');
        $this->createStandardTable('chat_messages');
    }

    /**
     * Reverts the migration.
     */
    public function down(): void
    {
        $this->forge->dropTable('chat_messages', true);
    }
}
