<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Libraries\Claude\ClaudeException;
use App\Models\PracticeQuestionModel;
use App\Models\UserAnswerModel;
use Config\Archie;
use JsonException;
use RuntimeException;
use Throwable;

/**
 * Practice questions and AI marking. Model answers never leave the server.
 */
class PracticeService
{
    private const MARK_FAILED = 'Marking is temporarily unavailable. Please try again in a moment.';

    /** Columns safe to return to students (no model_answer). */
    private const PUBLIC_COLUMNS = 'id, subject, grade, topic, question_text, marks, difficulty';

    /**
     * @param RateLimiter $limiter Hourly limiter
     */
    public function __construct(private readonly RateLimiter $limiter = new RateLimiter())
    {
    }

    /**
     * Random questions for a subject (and optional grade).
     *
     * @param array<string, mixed> $query { subject, grade?, limit? }
     * @return list<array<string, mixed>>
     * @throws ApiException 422 on invalid filters
     */
    public function questions(array $query): array
    {
        InputValidator::check($query, [
            'subject' => 'required|max_length[100]',
            'grade'   => 'permit_empty|is_natural|greater_than_equal_to[8]|less_than_equal_to[12]',
            'limit'   => 'permit_empty|is_natural_no_zero|less_than_equal_to[20]',
        ], ['subject' => ['required' => 'Choose a subject.']]);

        $builder = model(PracticeQuestionModel::class)->select(self::PUBLIC_COLUMNS)
            ->where('subject', (string) $query['subject']);

        if (($query['grade'] ?? '') !== '' && $query['grade'] !== null) {
            $builder->where('grade', (int) $query['grade']);
        }

        $rows = $builder->orderBy('id', 'RANDOM')->findAll((int) ($query['limit'] ?? 5) ?: 5);

        return array_map(static fn (array $q): array => [
            'id'            => (int) $q['id'],
            'subject'       => $q['subject'],
            'grade'         => (int) $q['grade'],
            'topic'         => $q['topic'],
            'question_text' => $q['question_text'],
            'marks'         => (int) $q['marks'],
            'difficulty'    => $q['difficulty'],
        ], $rows);
    }

    /**
     * Marks an answer with Claude Haiku against the stored model answer and stores it.
     *
     * @param int                  $userId Student
     * @param array<string, mixed> $input  { question_id, answer }
     * @return array{score: int, max_marks: int, feedback: string, encouragement: string}
     * @throws ApiException 422/404/429, 502 on AI failure (nothing stored)
     */
    public function answer(int $userId, array $input): array
    {
        InputValidator::check($input, [
            'question_id' => 'required|is_natural_no_zero',
            'answer'      => 'required|string|max_length[3000]',
        ], ['answer' => ['required' => 'Write an answer first.', 'max_length' => 'That answer is too long (3000 characters max).']]);

        $answer   = Format::cleanText((string) $input['answer']);
        $question = model(PracticeQuestionModel::class)->find((int) $input['question_id']);

        if ($question === null) {
            throw new ApiException('Question not found.', 404);
        }

        if ($answer === '') {
            throw ApiException::validation(['answer' => 'Write an answer first.']);
        }

        if ($this->limiter->hit($userId, 'mark', config(Archie::class)->markRateLimit)) {
            throw new ApiException("You've submitted a lot of answers this hour. Take a short break and try again soon.", 429);
        }

        $result = $this->mark($question, $answer);
        $this->store($userId, $question, $answer, $result);

        return $result;
    }

    /**
     * Calls Claude and parses/clamps the marking JSON.
     *
     * @param array<string, mixed> $question practice_questions row
     * @param string               $answer   Sanitised answer
     * @return array{score: int, max_marks: int, feedback: string, encouragement: string}
     * @throws ApiException 502 on any AI failure or refusal
     */
    private function mark(array $question, string $answer): array
    {
        $marks = max(1, (int) $question['marks']);

        try {
            $response = service('claude')->message(
                config(Archie::class)->markingModel,
                Prompts::MARKING_SYSTEM,
                [['role' => 'user', 'content' => Prompts::markingUser($question, $answer)]],
                1024,
            );

            if ($response->isRefusal() || preg_match('/\{.*\}/s', $response->text, $m) !== 1) {
                throw new ClaudeException('Marking response was a refusal or not JSON.');
            }

            $parsed = json_decode($m[0], true, 8, JSON_THROW_ON_ERROR);
        } catch (ClaudeException|JsonException $e) {
            log_message('error', '[PracticeService::mark] ' . $e->getMessage());

            throw new ApiException(self::MARK_FAILED, 502);
        }

        return [
            'score'         => min(max((int) ($parsed['score'] ?? 0), 0), $marks),
            'max_marks'     => $marks,
            'feedback'      => mb_substr(trim((string) ($parsed['feedback'] ?? '')), 0, 2000) ?: 'Good attempt.',
            'encouragement' => mb_substr(trim((string) ($parsed['encouragement'] ?? '')), 0, 500) ?: 'Keep going — you are improving!',
        ];
    }

    /**
     * Stores the marked answer.
     *
     * @param int                  $userId   Student
     * @param array<string, mixed> $question Question row
     * @param string               $answer   Answer text
     * @param array<string, mixed> $result   Marking result
     */
    private function store(int $userId, array $question, string $answer, array $result): void
    {
        $model = model(UserAnswerModel::class);

        try {
            $ok = $model->insert([
                'user_id'     => $userId,
                'question_id' => (int) $question['id'],
                'answer_text' => $answer,
                'ai_score'    => $result['score'],
                'ai_feedback' => $result['feedback'] . "\n\n" . $result['encouragement'],
                'max_marks'   => $result['max_marks'],
                'answered_at' => Format::now(),
            ]);

            if ($ok === false) {
                throw new RuntimeException('Answer insert failed: ' . implode(', ', $model->errors()));
            }
        } catch (Throwable $e) {
            log_message('error', '[PracticeService::store] ' . $e->getMessage());

            throw $e;
        }
    }
}
