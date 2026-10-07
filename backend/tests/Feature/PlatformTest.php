<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\AuditLogModel;
use LogicException;
use Tests\Support\ApiTestCase;

/**
 * Health, CORS and the audit trail.
 *
 * @internal
 */
final class PlatformTest extends ApiTestCase
{
    public function testHealth(): void
    {
        $response = $this->api('get', 'health');

        $response->assertStatus(200);
        $this->assertSame(['ok' => true, 'db' => true, 'version' => '1'], $this->body($response));
    }

    public function testRootAndUnknownRoutesAreJson404(): void
    {
        $this->freshRequestState();
        $root = $this->call('get', '/');
        $root->assertStatus(404);
        $this->assertSame(['error' => 'Not found.'], $this->body($root));
        $this->api('get', 'does-not-exist')->assertStatus(404);
    }
    public function testCorsPreflightForAllowedOrigin(): void
    {
        $this->freshRequestState();
        $response = $this->withHeaders([
            'Origin'                         => 'https://aptivai-droid.github.io',
            'Access-Control-Request-Method'  => 'POST',
            'Access-Control-Request-Headers' => 'authorization, content-type',
        ])->call('options', 'api/v1/chat/messages');

        $response->assertStatus(204);
        $response->assertHeader('Access-Control-Allow-Origin', 'https://aptivai-droid.github.io');
        $this->assertStringContainsStringIgnoringCase('authorization', $response->response()->getHeaderLine('Access-Control-Allow-Headers'));
    }

    public function testCorsRejectsUnknownOrigin(): void
    {
        $this->freshRequestState();
        $response = $this->withHeaders([
            'Origin'                        => 'https://evil.example.com',
            'Access-Control-Request-Method' => 'POST',
        ])->call('options', 'api/v1/chat/messages');

        $response->assertHeaderMissing('Access-Control-Allow-Origin');
    }

    public function testCorsHeadersOnNormalAndUnauthorisedResponses(): void
    {
        $this->api('get', 'health', [], null, ['Origin' => 'http://localhost:5173'])
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
        $this->api('get', 'me', [], null, ['Origin' => 'http://localhost:5173'])
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    }

    public function testWritesAreAuditedWithoutSecrets(): void
    {
        $student = $this->student('Audit');
        $profile = $this->db->table('profiles')->where('user_id', $student['id'])->get()->getRowArray();

        $this->seeInDatabase('audit_log', ['table_name' => 'profiles', 'record_id' => (string) $profile['id'], 'action' => 'insert']);
        $update = $this->db->table('audit_log')
            ->where(['table_name' => 'profiles', 'record_id' => (string) $profile['id'], 'action' => 'update'])
            ->get()->getRowArray();
        $this->assertNotNull($update);
        $this->assertSame($student['id'], (int) $update['user_id']);
        $this->assertNull(json_decode($update['old_values'], true)['first_name']);
        $this->assertSame('Audit', json_decode($update['new_values'], true)['first_name']);

        // Learner content never reaches the immutable audit trail.
        $this->api('post', 'chat/messages', ['subject' => 'Mathematics', 'content' => 'my private question'], $student['token'])->assertStatus(200);
        $message = $this->db->table('audit_log')->where('table_name', 'chat_messages')->orderBy('id', 'DESC')->get()->getRowArray();
        $this->assertSame('[redacted]', json_decode($message['new_values'], true)['content']);
        $this->assertStringNotContainsString('my private question', (string) $message['new_values']);

        config(\Config\Email::class)->fromEmail = 'no-reply@example.co.za';
        $this->api('post', 'auth/password/forgot', ['email' => $student['email']])->assertStatus(200);
        $reset = $this->db->table('audit_log')->where('table_name', 'password_resets')->orderBy('id', 'DESC')->get()->getRowArray();
        $this->assertSame('[redacted]', json_decode($reset['new_values'], true)['token_hash']);
    }

    public function testAuditLogIsAppendOnly(): void
    {
        $model = model(AuditLogModel::class);
        $id    = $model->record(['table_name' => 'test', 'record_id' => '1', 'action' => 'insert']);

        foreach ([
            static fn () => $model->update($id, ['action' => 'delete']),
            static fn () => $model->delete($id),
            static fn () => $model->save(['id' => $id, 'action' => 'delete']),
            static fn () => $model->replace(['id' => $id, 'table_name' => 'x', 'action' => 'insert']),
        ] as $attempt) {
            try {
                $attempt();
                $this->fail('AuditLogModel allowed a mutation.');
            } catch (LogicException) {
                // expected
            }
        }

        $this->seeInDatabase('audit_log', ['id' => $id, 'action' => 'insert']);
    }
}
