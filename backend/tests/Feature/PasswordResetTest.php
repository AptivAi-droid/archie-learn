<?php

declare(strict_types=1);

namespace Tests\Feature;

use Config\Email;
use Tests\Support\ApiTestCase;

/**
 * @internal
 */
final class PasswordResetTest extends ApiTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(Email::class)->fromEmail = 'no-reply@example.co.za';
    }

    public function testForgotUnknownEmailStillReturnsOk(): void
    {
        $response = $this->api('post', 'auth/password/forgot', ['email' => 'nobody-here@example.co.za']);

        $response->assertStatus(200);
        $this->assertSame(['ok' => true], $this->body($response));
        $this->assertEmpty(service('email')->archive ?? []);
    }

    public function testForgotAndResetFlow(): void
    {
        $student = $this->student();
        $this->api('post', 'auth/password/forgot', ['email' => $student['email']])->assertStatus(200);

        $token = $this->tokenFromEmail();
        $this->seeInDatabase('password_resets', ['user_id' => $student['id'], 'token_hash' => hash('sha256', $token), 'used_at' => null]);

        $this->api('post', 'auth/password/reset', ['token' => $token, 'password' => 'a-new-password'])->assertStatus(200);

        // Old sessions are revoked, the new password works, the link is single-use.
        $this->api('get', 'me', [], $student['token'])->assertStatus(401);
        $this->api('post', 'auth/login', ['email' => $student['email'], 'password' => 'a-new-password'])->assertStatus(200);

        $again = $this->api('post', 'auth/password/reset', ['token' => $token, 'password' => 'another-password']);
        $again->assertStatus(400);
        $this->assertSame('This reset link is invalid or has expired.', $this->body($again)['error']);
    }

    public function testExpiredTokenIsRejected(): void
    {
        $student = $this->student();
        $this->api('post', 'auth/password/forgot', ['email' => $student['email']])->assertStatus(200);
        $token = $this->tokenFromEmail();

        $this->db->table('password_resets')->where('user_id', $student['id'])
            ->update(['expires_at' => gmdate('Y-m-d H:i:s', time() - 60)]);

        $this->api('post', 'auth/password/reset', ['token' => $token, 'password' => 'a-new-password'])->assertStatus(400);
    }

    /**
     * Extracts the raw token from the mocked email.
     */
    private function tokenFromEmail(): string
    {
        $body = (string) (service('email')->archive['body'] ?? '');
        $this->assertSame(1, preg_match('/reset-password\?token=([0-9a-f]{64})/', $body, $m), 'Reset email not sent');

        return $m[1];
    }
}
