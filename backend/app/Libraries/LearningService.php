<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Models\BuddyCompanionModel;
use App\Models\ChatSessionModel;
use App\Models\LessonViewModel;
use App\Models\UserAnswerModel;
use RuntimeException;
use Throwable;

/**
 * Student learning records: lesson views, progress, and the companion ("buddy").
 */
class LearningService
{
    private const BUDDY_MAX_BYTES = 16384;

    /**
     * Records that a student opened a lesson topic.
     *
     * @param int                  $userId Student
     * @param array<string, mixed> $input  { subject, grade, topic_key }
     * @throws ApiException 422 on invalid input
     */
    public function recordLessonView(int $userId, array $input): void
    {
        InputValidator::check($input, [
            'subject'   => 'required|max_length[100]',
            'grade'     => 'required|is_natural|greater_than_equal_to[8]|less_than_equal_to[12]',
            'topic_key' => 'required|max_length[255]',
        ]);

        $this->insert(model(LessonViewModel::class), [
            'user_id'   => $userId,
            'subject'   => Format::cleanText((string) $input['subject']),
            'grade'     => (int) $input['grade'],
            'topic_key' => Format::cleanText((string) $input['topic_key']),
        ]);
    }

    /**
     * Progress for a student: sessions + lesson views (90 days), answers (latest 200).
     *
     * @param int $userId Student
     * @return array{sessions: list<array<string, mixed>>, answers: list<array<string, mixed>>, lesson_views: list<array<string, mixed>>}
     */
    public function progress(int $userId): array
    {
        $views = model(LessonViewModel::class)->select('subject, topic_key, created_at')
            ->where('user_id', $userId)->where('created_at >=', Format::now('-90 days'))
            ->orderBy('created_at', 'DESC')->findAll();

        return [
            'sessions'     => self::sessions($userId),
            'answers'      => self::answers($userId),
            'lesson_views' => array_map(static fn (array $v): array => [
                'subject'    => $v['subject'],
                'topic_key'  => $v['topic_key'],
                'created_at' => Format::iso($v['created_at']),
            ], $views),
        ];
    }

    /**
     * Chat sessions of the last 90 days, newest first.
     *
     * @param int $userId Student
     * @return list<array{id: int, subject: string, created_at: ?string}>
     */
    public static function sessions(int $userId): array
    {
        $rows = model(ChatSessionModel::class)->select('id, subject, created_at')
            ->where('user_id', $userId)->where('created_at >=', Format::now('-90 days'))
            ->orderBy('created_at', 'DESC')->orderBy('id', 'DESC')->findAll();

        return array_map(static fn (array $s): array => [
            'id'         => (int) $s['id'],
            'subject'    => $s['subject'],
            'created_at' => Format::iso($s['created_at']),
        ], $rows);
    }

    /**
     * Latest 200 marked answers, newest first.
     *
     * @param int $userId Student
     * @return list<array{question_id: int, subject: string, ai_score: ?int, max_marks: int, answered_at: ?string}>
     */
    public static function answers(int $userId): array
    {
        $rows = model(UserAnswerModel::class)
            ->select('user_answers.question_id, practice_questions.subject, user_answers.ai_score, user_answers.max_marks, user_answers.answered_at')
            ->join('practice_questions', 'practice_questions.id = user_answers.question_id')
            ->where('user_answers.user_id', $userId)
            ->orderBy('user_answers.answered_at', 'DESC')->orderBy('user_answers.id', 'DESC')
            ->findAll(200);

        return array_map(static fn (array $a): array => [
            'question_id' => (int) $a['question_id'],
            'subject'     => $a['subject'],
            'ai_score'    => Format::intOrNull($a['ai_score']),
            'max_marks'   => (int) $a['max_marks'],
            'answered_at' => Format::iso($a['answered_at']),
        ], $rows);
    }

    /**
     * The student's buddy data, or null.
     *
     * @param int $userId Student
     * @return array{buddy_data: array<mixed>|null}
     */
    public function buddy(int $userId): array
    {
        $row = model(BuddyCompanionModel::class)->where('user_id', $userId)->first();

        return ['buddy_data' => $row === null ? null : Format::jsonArray($row['buddy_data'])];
    }

    /**
     * Creates or replaces the student's buddy data.
     *
     * @param int                  $userId Student
     * @param array<string, mixed> $input  { buddy_data: object }
     * @return array{buddy_data: array<mixed>}
     * @throws ApiException 422 when buddy_data is not an object or exceeds 16 KB
     */
    public function saveBuddy(int $userId, array $input): array
    {
        $data = $input['buddy_data'] ?? null;

        if (! is_array($data) || ($data !== [] && array_is_list($data))) {
            throw ApiException::validation(['buddy_data' => 'buddy_data must be an object.']);
        }

        $json = (string) json_encode($data, JSON_UNESCAPED_UNICODE);

        if (strlen($json) > self::BUDDY_MAX_BYTES) {
            throw ApiException::validation(['buddy_data' => 'buddy_data is too large (16 KB max).']);
        }

        $model    = model(BuddyCompanionModel::class);
        $existing = $model->where('user_id', $userId)->first();

        if ($existing === null) {
            $this->insert($model, ['user_id' => $userId, 'buddy_data' => $json]);

            return ['buddy_data' => $data];
        }

        try {
            if (! $model->update((int) $existing['id'], ['buddy_data' => $json])) {
                throw new RuntimeException('Buddy update failed: ' . implode(', ', $model->errors()));
            }
        } catch (Throwable $e) {
            log_message('error', '[LearningService::saveBuddy] ' . $e->getMessage());

            throw $e;
        }

        return ['buddy_data' => $data];
    }

    /**
     * Inserts through a model with error logging.
     *
     * @param \CodeIgniter\Model   $model Model
     * @param array<string, mixed> $row   Values
     */
    private function insert(\CodeIgniter\Model $model, array $row): void
    {
        try {
            if ($model->insert($row) === false) {
                throw new RuntimeException('Insert failed: ' . implode(', ', $model->errors()));
            }
        } catch (Throwable $e) {
            log_message('error', '[LearningService::insert] ' . $e->getMessage());

            throw $e;
        }
    }
}
