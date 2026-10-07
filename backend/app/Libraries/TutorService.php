<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Libraries\Claude\ClaudeException;
use App\Models\ChatMessageModel;
use App\Models\ChatSessionModel;
use Config\Archie;
use RuntimeException;
use Throwable;

/**
 * Tutor chat: sessions, stored history, prompt building and the Claude call.
 * The client sends only the new message; history and the system prompt come from the DB.
 */
class TutorService
{
    private const HISTORY_LIMIT = 20;
    private const AI_FAILED     = 'Archie is having trouble thinking right now. Please try again in a moment.';

    /** Learner-safe reply used when Claude's safety classifiers decline. */
    public const REFUSAL_REPLY = "I can't help with that one, but I'm right here for your schoolwork. "
        . 'If something is worrying you, please talk to a trusted adult, or call Childline on 116 (free, 24 hours). '
        . 'What would you like to work on?';

    /**
     * @param ProfileService $profiles Profile lookup
     * @param RateLimiter    $limiter  Hourly limiter
     */
    public function __construct(
        private readonly ProfileService $profiles = new ProfileService(),
        private readonly RateLimiter $limiter = new RateLimiter(),
    ) {
    }

    /**
     * Stores the learner's message, asks Claude, stores and returns the reply.
     *
     * @param int                  $userId Student user id
     * @param array<string, mixed> $input  { session_id, subject, content }
     * @return array{session_id: int, reply: array<string, mixed>}
     * @throws ApiException 422/403/404/429, or 502 (body includes session_id) on AI failure
     */
    public function send(int $userId, array $input): array
    {
        InputValidator::check($input, [
            'session_id' => 'permit_empty|is_natural_no_zero',
            'subject'    => 'permit_empty|max_length[100]',
            'content'    => 'required|string|max_length[2000]',
        ], ['content' => ['required' => 'Type a message first.', 'max_length' => 'That message is too long (2000 characters max).']]);

        $content = Format::cleanText((string) $input['content']);

        if ($content === '') {
            throw ApiException::validation(['content' => 'Type a message first.']);
        }

        if ($this->limiter->hit($userId, 'chat', config(Archie::class)->chatRateLimit)) {
            $limit = config(Archie::class)->chatRateLimit;

            throw new ApiException("You've sent a lot of messages this hour! Take a short break and come back soon. (Limit: {$limit}/hour)", 429);
        }

        $profile = $this->profiles->rowFor($userId);
        $session = $this->resolveSession($userId, $input, $profile);
        $this->storeMessage((int) $session['id'], $userId, 'user', $content);

        $reply = $this->askClaude($profile, $session);
        $saved = $this->storeMessage((int) $session['id'], $userId, 'assistant', $reply);

        return [
            'session_id' => (int) $session['id'],
            'reply'      => ['role' => 'assistant', 'content' => $saved['content'], 'created_at' => Format::iso($saved['created_at'])],
        ];
    }

    /**
     * Messages of a session the caller owns, oldest first.
     *
     * @param int $userId    Caller
     * @param int $sessionId chat_sessions.id
     * @return list<array{role: string, content: string, created_at: ?string}>
     * @throws ApiException 404 missing, 403 not the owner
     */
    public function messages(int $userId, int $sessionId): array
    {
        $session = model(ChatSessionModel::class)->find($sessionId);

        if ($session === null) {
            throw new ApiException('Chat session not found.', 404);
        }

        if ((int) $session['user_id'] !== $userId) {
            throw new ApiException("That chat isn't yours.", 403);
        }

        return self::sessionMessages($sessionId);
    }

    /**
     * All messages of a session, oldest first, in API shape.
     *
     * @param int $sessionId chat_sessions.id
     * @return list<array{role: string, content: string, created_at: ?string}>
     */
    public static function sessionMessages(int $sessionId): array
    {
        $rows = model(ChatMessageModel::class)->select('role, content, created_at')
            ->where('session_id', $sessionId)->orderBy('id', 'ASC')->findAll();

        return array_map(static fn (array $r): array => [
            'role'       => $r['role'],
            'content'    => $r['content'],
            'created_at' => Format::iso($r['created_at']),
        ], $rows);
    }

    /**
     * Loads the caller's session, or creates one (with Archie's greeting) when session_id is null.
     *
     * @param int                  $userId  Caller
     * @param array<string, mixed> $input   Request body
     * @param array<string, mixed> $profile Caller's profile row
     * @return array<string, mixed> chat_sessions row
     * @throws ApiException 404/403 for a foreign or missing session, 422 when subject is missing
     */
    private function resolveSession(int $userId, array $input, array $profile): array
    {
        if (! empty($input['session_id'])) {
            $session = model(ChatSessionModel::class)->find((int) $input['session_id']);

            if ($session === null) {
                throw new ApiException('Chat session not found.', 404);
            }

            if ((int) $session['user_id'] !== $userId) {
                throw new ApiException("That chat isn't yours.", 403);
            }

            return $session;
        }

        $subject = InputValidator::optionalString($input, 'subject') ?? $profile['primary_subject'];

        if ($subject === null || $subject === '') {
            throw ApiException::validation(['subject' => 'Choose a subject to start a chat.']);
        }

        return $this->createSession($userId, mb_substr($subject, 0, 100), (string) ($profile['first_name'] ?? ''));
    }

    /**
     * Creates a session and stores Archie's greeting as its first message.
     *
     * @param int    $userId    Caller
     * @param string $subject   Session subject
     * @param string $firstName Learner first name
     * @return array<string, mixed> chat_sessions row
     */
    private function createSession(int $userId, string $subject, string $firstName): array
    {
        $model = model(ChatSessionModel::class);

        try {
            $id = $model->insert(['user_id' => $userId, 'subject' => $subject], true);

            if ($id === false) {
                throw new RuntimeException('Session insert failed: ' . implode(', ', $model->errors()));
            }
        } catch (Throwable $e) {
            log_message('error', '[TutorService::createSession] ' . $e->getMessage());

            throw $e;
        }

        $name = $firstName !== '' ? $firstName : 'there';
        $this->storeMessage((int) $id, $userId, 'assistant', "Hey {$name}! What are we working on today?");

        return $model->find($id);
    }

    /**
     * Builds the prompt from DB history and calls Claude.
     *
     * @param array<string, mixed> $profile Learner profile row
     * @param array<string, mixed> $session chat_sessions row
     * @return string Reply text (the learner-safe refusal reply on refusal)
     * @throws ApiException 502 (with session_id) when Claude fails
     */
    private function askClaude(array $profile, array $session): string
    {
        $name   = mb_substr(Format::cleanText((string) ($profile['first_name'] ?? 'Learner')), 0, 50) ?: 'Learner';
        $grade  = $profile['grade'] ?? 10;
        $system = Prompts::tutorSystem($name, $grade, Format::cleanText((string) $session['subject']));

        try {
            $response = service('claude')->message(
                config(Archie::class)->tutorModel,
                $system,
                $this->history((int) $session['id']),
                4096,
                'low',
            );
        } catch (ClaudeException $e) {
            log_message('error', '[TutorService::askClaude] ' . $e->getMessage());

            throw new ApiException(self::AI_FAILED, 502, [], ['session_id' => (int) $session['id']]);
        }

        return $response->isRefusal() ? self::REFUSAL_REPLY : mb_substr(trim($response->text), 0, 16000);
    }

    /**
     * Last HISTORY_LIMIT messages, oldest first, starting with a user turn.
     *
     * @param int $sessionId chat_sessions.id
     * @return list<array{role: string, content: string}>
     */
    private function history(int $sessionId): array
    {
        $rows = model(ChatMessageModel::class)->select('role, content')
            ->where('session_id', $sessionId)->orderBy('id', 'DESC')->findAll(self::HISTORY_LIMIT);

        $messages = array_map(
            static fn (array $r): array => ['role' => $r['role'], 'content' => $r['content']],
            array_reverse($rows),
        );

        // The Messages API requires the conversation to start with a user turn
        // (Archie's greeting is an assistant message).
        while ($messages !== [] && $messages[0]['role'] !== 'user') {
            array_shift($messages);
        }

        return $messages;
    }

    /**
     * Stores one chat message.
     *
     * @param int    $sessionId Session
     * @param int    $userId    Owner
     * @param string $role      user|assistant
     * @param string $content   Text
     * @return array<string, mixed> Stored row
     */
    private function storeMessage(int $sessionId, int $userId, string $role, string $content): array
    {
        $model = model(ChatMessageModel::class);

        try {
            $id = $model->insert(['session_id' => $sessionId, 'user_id' => $userId, 'role' => $role, 'content' => $content], true);

            if ($id === false) {
                throw new RuntimeException('Message insert failed: ' . implode(', ', $model->errors()));
            }

            return $model->find($id);
        } catch (Throwable $e) {
            log_message('error', '[TutorService::storeMessage] ' . $e->getMessage());

            throw $e;
        }
    }
}
