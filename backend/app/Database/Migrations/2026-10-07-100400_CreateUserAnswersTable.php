<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use App\Database\ArchieMigration;

/**
 * Creates the `user_answers` table.
 */
class CreateUserAnswersTable extends ArchieMigration
{
    /**
     * Applies the migration.
     */
    public function up(): void
    {
        $this->forge->addField($this->idField() + [
            'user_id'     => $this->userIdColumn(),
            'question_id' => $this->bigFkColumn(),
            'answer_text' => ['type' => 'TEXT'],
            'ai_score'    => ['type' => 'TINYINT', 'unsigned' => true, 'null' => true],
            'ai_feedback' => ['type' => 'TEXT', 'null' => true],
            'max_marks'   => ['type' => 'TINYINT', 'unsigned' => true, 'default' => 4],
            'answered_at' => ['type' => 'DATETIME', 'null' => false],
        ] + $this->timestampFields());
        $this->forge->addKey('id', true);
        $this->forge->addKey(['user_id', 'answered_at']);
        $this->forge->addKey('question_id');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE', 'fk_user_answers_user');
        $this->forge->addForeignKey('question_id', 'practice_questions', 'id', 'CASCADE', 'CASCADE', 'fk_user_answers_question');
        $this->createStandardTable('user_answers');
    }

    /**
     * Reverts the migration.
     */
    public function down(): void
    {
        $this->forge->dropTable('user_answers', true);
    }
}
