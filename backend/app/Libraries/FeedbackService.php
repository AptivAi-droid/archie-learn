<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Models\ChatSessionModel;
use App\Models\FeedbackModel;
use RuntimeException;
use Throwable;

/**
 * Stores feedback from the in-app FeedbackModal.
 */
class FeedbackService
{
    /**
     * Saves one feedback entry.
     *
     * @param int                  $userId Caller
     * @param array<string, mixed> $input  { rating 1–5, session_id?, what_worked?, what_frustrated? }
     * @throws ApiException 422 on invalid input
     */
    public function create(int $userId, array $input): void
    {
        InputValidator::check($input, [
            'rating'          => 'required|is_natural_no_zero|less_than_equal_to[5]',
            'session_id'      => 'permit_empty|is_natural_no_zero',
            'what_worked'     => 'permit_empty|max_length[2000]',
            'what_frustrated' => 'permit_empty|max_length[2000]',
        ], ['rating' => ['required' => 'Pick a star rating.', 'less_than_equal_to' => 'Rating must be 1 to 5.']]);

        $model = model(FeedbackModel::class);

        try {
            $ok = $model->insert([
                'user_id'         => $userId,
                'session_id'      => $this->ownSessionId($userId, $input['session_id'] ?? null),
                'rating'          => (int) $input['rating'],
                'what_worked'     => InputValidator::optionalString($input, 'what_worked'),
                'what_frustrated' => InputValidator::optionalString($input, 'what_frustrated'),
            ]);

            if ($ok === false) {
                throw new RuntimeException('Feedback insert failed: ' . implode(', ', $model->errors()));
            }
        } catch (Throwable $e) {
            log_message('error', '[FeedbackService::create] ' . $e->getMessage());

            throw $e;
        }
    }

    /**
     * Keeps session_id only when it belongs to the caller.
     *
     * @param int   $userId    Caller
     * @param mixed $sessionId Request value
     */
    private function ownSessionId(int $userId, mixed $sessionId): ?int
    {
        if ($sessionId === null || $sessionId === '') {
            return null;
        }

        $session = model(ChatSessionModel::class)->find((int) $sessionId);

        return $session !== null && (int) $session['user_id'] === $userId ? (int) $session['id'] : null;
    }
}
