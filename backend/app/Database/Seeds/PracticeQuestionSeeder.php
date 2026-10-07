<?php

declare(strict_types=1);

namespace App\Database\Seeds;

use App\Models\PracticeQuestionModel;
use CodeIgniter\Database\Seeder;
use RuntimeException;

/**
 * Seeds the CAPS practice question bank (ported from the legacy Supabase seeds).
 * Idempotent: questions already present (same subject, grade and question text) are skipped.
 *
 * Usage: php spark db:seed PracticeQuestionSeeder
 */
class PracticeQuestionSeeder extends Seeder
{
    /**
     * Inserts every question that is not yet present.
     */
    public function run(): void
    {
        /** @var list<array{subject: string, grade: int, question_text: string, model_answer: string, marks: int, difficulty: string}> $questions */
        $questions = require __DIR__ . '/data/practice_questions.php';
        $model     = model(PracticeQuestionModel::class);

        foreach ($questions as $question) {
            $hash = hash('sha256', $question['question_text']);

            $exists = $model->where(['subject' => $question['subject'], 'grade' => $question['grade'], 'question_hash' => $hash])
                ->countAllResults() > 0;

            if ($exists) {
                continue;
            }

            if ($model->insert($question + ['question_hash' => $hash]) === false) {
                throw new RuntimeException('Seeding question failed: ' . implode(', ', $model->errors()));
            }
        }
    }
}
