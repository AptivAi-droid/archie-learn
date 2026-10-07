<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use App\Database\ArchieMigration;

/**
 * Creates the `practice_questions` table.
 */
class CreatePracticeQuestionsTable extends ArchieMigration
{
    /**
     * Applies the migration.
     */
    public function up(): void
    {
        // question_hash = SHA-256 of question_text. TEXT cannot sit in a unique index without a
        // prefix length, so the natural key (subject, grade, question_text) uses the hash.
        $this->forge->addField($this->idField() + [
            'subject'       => ['type' => 'VARCHAR', 'constraint' => 100],
            'grade'         => ['type' => 'TINYINT', 'unsigned' => true],
            'topic'         => ['type' => 'VARCHAR', 'constraint' => 150, 'null' => true],
            'question_text' => ['type' => 'TEXT'],
            'question_hash' => ['type' => 'CHAR', 'constraint' => 64],
            'model_answer'  => ['type' => 'TEXT'],
            'marks'         => ['type' => 'TINYINT', 'unsigned' => true, 'default' => 4],
            'difficulty'    => ['type' => 'VARCHAR', 'constraint' => 10, 'default' => 'medium'],
        ] + $this->timestampFields());
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey(['subject', 'grade', 'question_hash'], 'uq_practice_questions_natural');
        $this->forge->addKey(['subject', 'grade']);
        $this->createStandardTable('practice_questions');
    }

    /**
     * Reverts the migration.
     */
    public function down(): void
    {
        $this->forge->dropTable('practice_questions', true);
    }
}
