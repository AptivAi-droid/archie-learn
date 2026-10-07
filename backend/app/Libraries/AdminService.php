<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Models\ChatMessageModel;
use App\Models\ChatSessionModel;
use App\Models\FeedbackModel;
use App\Models\ProfileModel;
use App\Models\SignupApplicationModel;
use CodeIgniter\Shield\Entities\User;
use Config\Database;
use RuntimeException;
use Throwable;

/**
 * Admin dashboard data and application review.
 */
class AdminService
{
    private const LATEST = 200;

    /**
     * @param AccountService $accounts Account creation for approvals
     */
    public function __construct(private readonly AccountService $accounts = new AccountService())
    {
    }

    /**
     * Latest profiles, feedback, sessions (with message counts) and applications.
     *
     * @return array<string, list<array<string, mixed>>>
     */
    public function overview(): array
    {
        $profiles = model(ProfileModel::class)->orderBy('created_at', 'DESC')->findAll(self::LATEST);
        $feedback = model(FeedbackModel::class)->orderBy('created_at', 'DESC')->findAll(self::LATEST);
        $apps     = model(SignupApplicationModel::class)->orderBy('created_at', 'DESC')->findAll(self::LATEST);
        $sessions = model(ChatSessionModel::class)
            ->select('chat_sessions.id, chat_sessions.user_id, chat_sessions.subject, chat_sessions.created_at, COUNT(chat_messages.id) AS message_count', false)
            ->join('chat_messages', 'chat_messages.session_id = chat_sessions.id', 'left')
            ->groupBy('chat_sessions.id')
            ->orderBy('chat_sessions.created_at', 'DESC')
            ->findAll(self::LATEST);

        return [
            'profiles'     => array_map(ProfileService::format(...), $profiles),
            'feedback'     => array_map(static fn (array $f): array => [
                'id'              => (int) $f['id'],
                'user_id'         => (int) $f['user_id'],
                'session_id'      => Format::intOrNull($f['session_id']),
                'rating'          => (int) $f['rating'],
                'what_worked'     => $f['what_worked'],
                'what_frustrated' => $f['what_frustrated'],
                'created_at'      => Format::iso($f['created_at']),
            ], $feedback),
            'sessions'     => array_map(static fn (array $s): array => [
                'id'            => (int) $s['id'],
                'user_id'       => (int) $s['user_id'],
                'subject'       => $s['subject'],
                'created_at'    => Format::iso($s['created_at']),
                'message_count' => (int) $s['message_count'],
            ], $sessions),
            'applications' => array_map(ApplicationService::format(...), $apps),
        ];
    }

    /**
     * Messages of any session.
     *
     * @param int $sessionId chat_sessions.id
     * @return list<array<string, mixed>>
     * @throws ApiException 404
     */
    public function sessionMessages(int $sessionId): array
    {
        if (model(ChatSessionModel::class)->find($sessionId) === null) {
            throw new ApiException('Chat session not found.', 404);
        }

        return TutorService::sessionMessages($sessionId);
    }

    /**
     * Records an admin decision; APPROVED creates the account with the applied role.
     *
     * @param int                  $adminId Reviewer
     * @param int                  $appId   Application id
     * @param array<string, mixed> $input   { status: APPROVED|REJECTED, notes? }
     * @return array{application: array<string, mixed>}
     * @throws ApiException 422 / 404 / 409
     */
    public function decide(int $adminId, int $appId, array $input): array
    {
        InputValidator::check($input, [
            'status' => 'required|in_list[APPROVED,REJECTED]',
            'notes'  => 'permit_empty|max_length[2000]',
        ], ['status' => ['in_list' => 'Status must be APPROVED or REJECTED.']]);

        $model = model(SignupApplicationModel::class);
        $app   = $model->find($appId);

        if ($app === null) {
            throw new ApiException('Application not found.', 404);
        }

        $changes = [
            'status'         => $input['status'],
            'admin_decision' => $input['status'],
            'admin_notes'    => InputValidator::optionalString($input, 'notes'),
            'reviewed_by'    => $adminId,
            'reviewed_at'    => Format::now(),
            'password_hash'  => null,
        ];

        $this->applyDecision($model, $app, $changes);

        return ['application' => ApplicationService::format($model->find($appId))];
    }

    /**
     * Creates the account (APPROVED) or blocks an existing one (REJECTED) and records the
     * decision, all in one transaction.
     *
     * @param SignupApplicationModel $model   Model
     * @param array<string, mixed>   $app     Application row
     * @param array<string, mixed>   $changes Decision columns
     * @throws ApiException 409 (see createApprovedAccount)
     * @throws RuntimeException When a write fails (rolled back)
     */
    private function applyDecision(SignupApplicationModel $model, array $app, array $changes): void
    {
        $db = Database::connect();
        $db->transException(true)->transStart();

        try {
            if ($changes['status'] === 'APPROVED' && $app['created_user_id'] === null) {
                $changes['created_user_id'] = $this->createApprovedAccount($app);
            }

            if ($changes['status'] === 'REJECTED' && $app['created_user_id'] !== null) {
                $this->blockUser((int) $app['created_user_id']);
            }

            if (! $model->update((int) $app['id'], $changes)) {
                throw new RuntimeException('Application update failed: ' . implode(', ', $model->errors()));
            }

            $db->transComplete();
        } catch (Throwable $e) {
            $db->transRollback();
            log_message('error', '[AdminService::applyDecision] ' . $e->getMessage());

            throw $e;
        }
    }

    /**
     * Bans a previously created account and revokes all of its access tokens.
     *
     * @param int $userId Shield user id
     */
    private function blockUser(int $userId): void
    {
        /** @var User|null $user */
        $user = auth()->getProvider()->findById($userId);

        if ($user === null) {
            return;
        }

        $user->ban('Application rejected by an administrator.');
        $user->revokeAllAccessTokens();
    }
    /**
     * Creates the account for an approved application from its stored password hash.
     *
     * @param array<string, mixed> $app Application row
     * @return int New user id
     * @throws ApiException 409 when no password is stored or the email is taken
     */
    private function createApprovedAccount(array $app): int
    {
        if (($app['password_hash'] ?? null) === null || $app['password_hash'] === '') {
            throw new ApiException('This application no longer holds a password. Ask the applicant to apply again.', 409);
        }

        $data      = Format::jsonArray($app['application_data']);
        $firstName = InputValidator::optionalString($data, 'first_name') ?? explode('@', (string) $app['email'])[0];
        $profile   = $this->accounts->createAccount(
            ['email' => $app['email'], 'role' => $app['requested_role'], 'dob' => $app['dob'], 'first_name' => mb_substr($firstName, 0, 100)],
            null,
            (string) $app['password_hash'],
        );

        return (int) $profile['user_id'];
    }
}
