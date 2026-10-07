<?php

declare(strict_types=1);

namespace Tests\Feature;

use Config\Archie;
use Tests\Support\ApiTestCase;

/**
 * @internal
 */
final class AuthTest extends ApiTestCase
{
    public function testRegisterStudentReturnsTokenAndProfile(): void
    {
        $email    = $this->email();
        $response = $this->api('post', 'auth/register', ['email' => $email, 'password' => 'secret-pass-1', 'dob' => $this->dobForAge(15)]);

        $response->assertStatus(201);
        $body = $this->body($response);
        $this->assertNotEmpty($body['token']);
        $this->assertSame('student', $body['profile']['role']);
        $this->assertSame($email, $body['profile']['email']);
        $this->assertIsInt($body['profile']['id']);
        $this->assertFalse($body['profile']['setup_complete']);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/', $body['profile']['created_at']);
    }

    public function testRegisterUnder13IsRejected(): void
    {
        $response = $this->api('post', 'auth/register', ['email' => $this->email(), 'password' => 'secret-pass-1', 'dob' => $this->dobForAge(12)]);

        $response->assertStatus(422);
        $this->assertSame('Archie is for learners aged 13 and up.', $this->body($response)['error']);
    }

    public function testRegisterAdultGetsAdultCode(): void
    {
        $response = $this->api('post', 'auth/register', ['email' => $this->email(), 'password' => 'secret-pass-1', 'dob' => $this->dobForAge(30)]);

        $response->assertStatus(422);
        $this->assertSame('ADULT', $this->body($response)['code']);
    }

    public function testRegisterDuplicateEmailIs409(): void
    {
        $email = $this->email();
        $this->api('post', 'auth/register', ['email' => $email, 'password' => 'secret-pass-1', 'dob' => $this->dobForAge(15)])->assertStatus(201);

        $this->api('post', 'auth/register', ['email' => strtoupper($email), 'password' => 'secret-pass-1', 'dob' => $this->dobForAge(15)])
            ->assertStatus(409);
    }

    public function testRegisterValidatesPasswordLength(): void
    {
        $response = $this->api('post', 'auth/register', ['email' => $this->email(), 'password' => 'short', 'dob' => $this->dobForAge(15)]);

        $response->assertStatus(422);
        $this->assertArrayHasKey('password', $this->body($response)['errors']);
    }

    public function testLoginSucceedsAndFailsWithGenericMessage(): void
    {
        $student = $this->student();

        $ok = $this->api('post', 'auth/login', ['email' => $student['email'], 'password' => 'secret-pass-1']);
        $ok->assertStatus(200);
        $this->assertSame($student['id'], $this->body($ok)['profile']['id']);

        $bad = $this->api('post', 'auth/login', ['email' => $student['email'], 'password' => 'wrong-password']);
        $bad->assertStatus(401);
        $this->assertSame("That email and password don't match.", $this->body($bad)['error']);

        $this->api('post', 'auth/login', ['email' => 'nobody@example.co.za', 'password' => 'whatever-123'])->assertStatus(401);
    }

    public function testMeRequiresAValidToken(): void
    {
        $this->api('get', 'me')->assertStatus(401);
        $this->api('get', 'me', [], 'not-a-real-token')->assertStatus(401);

        $student = $this->student('Lerato', 11);
        $me      = $this->body($this->api('get', 'me', [], $student['token']))['profile'];

        $this->assertSame('Lerato', $me['first_name']);
        $this->assertSame(11, $me['grade']);
        $this->assertTrue($me['setup_complete']);
    }

    public function testProfileUpdateCannotChangeRoleOrEmail(): void
    {
        $student  = $this->student();
        $response = $this->api('put', 'me/profile', ['role' => 'admin', 'email' => 'evil@example.co.za', 'school' => 'Hoërskool Waterkloof', 'subjects' => ['Mathematics', 'Life Sciences']], $student['token']);

        $response->assertStatus(200);
        $profile = $this->body($response)['profile'];
        $this->assertSame('student', $profile['role']);
        $this->assertSame($student['email'], $profile['email']);
        $this->assertSame('Hoërskool Waterkloof', $profile['school']);
        $this->assertSame(['Mathematics', 'Life Sciences'], $profile['subjects']);
    }

    public function testProfileGradeMustBe8To12(): void
    {
        $student = $this->student();

        $this->api('put', 'me/profile', ['grade' => 7], $student['token'])->assertStatus(422);
        $this->api('put', 'me/profile', ['grade' => 13], $student['token'])->assertStatus(422);
    }

    public function testLogoutRevokesTheToken(): void
    {
        $student = $this->student();

        $this->api('post', 'auth/logout', [], $student['token'])->assertStatus(200);
        $this->api('get', 'me', [], $student['token'])->assertStatus(401);
    }

    public function testChangePasswordRequiresCurrentPassword(): void
    {
        $student = $this->student();

        $this->api('put', 'me/password', ['current_password' => 'wrong-one-1', 'new_password' => 'brand-new-pass'], $student['token'])
            ->assertStatus(400);
        $this->api('put', 'me/password', ['current_password' => 'secret-pass-1', 'new_password' => 'brand-new-pass'], $student['token'])
            ->assertStatus(200);
        $this->api('post', 'auth/login', ['email' => $student['email'], 'password' => 'brand-new-pass'])->assertStatus(200);
    }

    public function testLoginIsThrottledPerIp(): void
    {
        config(Archie::class)->throttle['auth'] = [2, MINUTE];

        $this->api('post', 'auth/login', ['email' => 'a@example.co.za', 'password' => 'x-password'])->assertStatus(401);
        $this->api('post', 'auth/login', ['email' => 'a@example.co.za', 'password' => 'x-password'])->assertStatus(401);
        $this->api('post', 'auth/login', ['email' => 'a@example.co.za', 'password' => 'x-password'])->assertStatus(429);
    }
}
