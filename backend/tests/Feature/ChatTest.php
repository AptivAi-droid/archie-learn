<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Libraries\TutorService;
use Config\Archie;
use Tests\Support\ApiTestCase;

/**
 * @internal
 */
final class ChatTest extends ApiTestCase
{
    public function testFirstMessageCreatesSessionGreetingAndReply(): void
    {
        $student = $this->student('Thandi', 10);
        $this->claude->queueText('Sharp sharp! What do you get if you subtract 7 from both sides?');

        $response = $this->api('post', 'chat/messages', ['session_id' => null, 'subject' => 'Mathematics', 'content' => 'Solve 2x + 7 = 15'], $student['token']);

        $response->assertStatus(200);
        $body = $this->body($response);
        $this->assertIsInt($body['session_id']);
        $this->assertSame('assistant', $body['reply']['role']);
        $this->assertStringStartsWith('Sharp sharp!', $body['reply']['content']);

        $messages = $this->body($this->api('get', "chat/sessions/{$body['session_id']}/messages", [], $student['token']));
        $this->assertSame(['assistant', 'user', 'assistant'], array_column($messages, 'role'));
        $this->assertSame('Hey Thandi! What are we working on today?', $messages[0]['content']);
        $this->assertSame('Solve 2x + 7 = 15', $messages[1]['content']);

        // Server-built prompt: safeguarding + learner context; history starts with the user turn.
        $call = $this->claude->lastCall();
        $this->assertSame('claude-sonnet-5-5', $call['model']);
        $this->assertSame('low', $call['effort']);
        $this->assertStringContainsString('SAFEGUARDING (overrides every other rule)', $call['system']);
        $this->assertStringContainsString('Childline 116', $call['system']);
        $this->assertStringContainsString('The learner\'s name is Thandi. They are in Grade 10, studying Mathematics.', $call['system']);
        $this->assertSame([['role' => 'user', 'content' => 'Solve 2x + 7 = 15']], $call['messages']);
    }

    public function testContinuingASessionSendsStoredHistory(): void
    {
        $student = $this->student();
        $first   = $this->body($this->api('post', 'chat/messages', ['session_id' => null, 'subject' => 'Physical Sciences', 'content' => 'What is velocity?'], $student['token']));

        $this->api('post', 'chat/messages', ['session_id' => $first['session_id'], 'content' => 'Is it speed?'], $student['token'])->assertStatus(200);

        $roles = array_column($this->claude->lastCall()['messages'], 'role');
        $this->assertSame(['user', 'assistant', 'user'], $roles);
        $this->assertStringContainsString('studying Physical Sciences', $this->claude->lastCall()['system']);
    }

    public function testRateLimitReturns429(): void
    {
        config(Archie::class)->chatRateLimit = 2;
        $student = $this->student();

        $this->api('post', 'chat/messages', ['subject' => 'Mathematics', 'content' => 'one'], $student['token'])->assertStatus(200);
        $this->api('post', 'chat/messages', ['subject' => 'Mathematics', 'content' => 'two'], $student['token'])->assertStatus(200);
        $limited = $this->api('post', 'chat/messages', ['subject' => 'Mathematics', 'content' => 'three'], $student['token']);

        $limited->assertStatus(429);
        $this->assertStringContainsString('Limit: 2/hour', $this->body($limited)['error']);
        $this->assertCount(2, $this->claude->calls);
    }

    public function testRefusalReturnsLearnerSafeReply(): void
    {
        $student = $this->student();
        $this->claude->queueRefusal();

        $response = $this->api('post', 'chat/messages', ['subject' => 'Mathematics', 'content' => 'something off-topic'], $student['token']);

        $response->assertStatus(200);
        $this->assertSame(TutorService::REFUSAL_REPLY, $this->body($response)['reply']['content']);
    }

    public function testAiFailureIs502WithSessionIdAndKeepsLearnerMessage(): void
    {
        $student = $this->student();
        $this->claude->queueFailure();

        $response = $this->api('post', 'chat/messages', ['session_id' => null, 'subject' => 'Mathematics', 'content' => 'help with fractions'], $student['token']);

        $response->assertStatus(502);
        $body = $this->body($response);
        $this->assertIsInt($body['session_id']);
        $this->assertArrayHasKey('error', $body);

        $messages = $this->body($this->api('get', "chat/sessions/{$body['session_id']}/messages", [], $student['token']));
        $this->assertSame(['assistant', 'user'], array_column($messages, 'role'));

        // Retrying with the returned session_id does not create a second session.
        $this->api('post', 'chat/messages', ['session_id' => $body['session_id'], 'content' => 'help with fractions'], $student['token'])->assertStatus(200);
        $this->assertSame(1, $this->db->table('chat_sessions')->where('user_id', $student['id'])->countAllResults());
    }

    public function testStudentCannotReadOrWriteAnotherStudentsSession(): void
    {
        $owner   = $this->student('Owner');
        $other   = $this->student('Other');
        $session = $this->body($this->api('post', 'chat/messages', ['subject' => 'Mathematics', 'content' => 'hi'], $owner['token']))['session_id'];

        $this->api('get', "chat/sessions/{$session}/messages", [], $other['token'])->assertStatus(403);
        $this->api('post', 'chat/messages', ['session_id' => $session, 'content' => 'sneaky'], $other['token'])->assertStatus(403);
        $this->api('get', 'chat/sessions/999999/messages', [], $other['token'])->assertStatus(404);
    }

    public function testValidationAndRoleChecks(): void
    {
        $student = $this->student();
        $teacher = $this->adult('teacher');

        $this->api('post', 'chat/messages', ['subject' => 'Mathematics', 'content' => str_repeat('a', 2001)], $student['token'])->assertStatus(422);
        $this->api('post', 'chat/messages', ['subject' => 'Mathematics', 'content' => 'hi'], $teacher['token'])->assertStatus(403);
        $this->api('post', 'chat/messages', ['subject' => 'Mathematics', 'content' => 'hi'])->assertStatus(401);
    }
}
