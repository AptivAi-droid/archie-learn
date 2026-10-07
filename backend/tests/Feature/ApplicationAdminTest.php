<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\Support\ApiTestCase;

/**
 * @internal
 */
final class ApplicationAdminTest extends ApiTestCase
{
    /**
     * @return array<string, mixed>
     */
    private function application(string $role = 'teacher'): array
    {
        return [
            'email'            => $this->email('applicant'),
            'password'         => 'teacher-pass-1',
            'role'             => $role,
            'dob'              => '1984-02-10',
            'application_data' => ['first_name' => 'Nomsa', 'school' => 'Pretoria High School for Girls', 'subjects' => ['Mathematics'], 'years_experience' => 12, 'why_join' => 'To support my learners after hours.'],
        ];
    }

    public function testApprovedApplicationCreatesAccountWithRole(): void
    {
        $this->claude->queueText('{"decision":"APPROVED","confidence":0.95,"reasoning":"Coherent teacher profile.","red_flags":[]}');
        $input = $this->application();

        $response = $this->api('post', 'applications', $input);

        $response->assertStatus(200);
        $body = $this->body($response);
        $this->assertSame('APPROVED', $body['status']);
        $this->assertSame('teacher', $body['profile']['role']);
        $this->assertSame('Nomsa', $body['profile']['first_name']);
        $this->api('get', 'teacher/classes', [], $body['token'])->assertStatus(200);
        $this->assertSame('claude-sonnet-5-5', $this->claude->lastCall()['model']);
        $this->seeInDatabase('signup_applications', ['email' => $input['email'], 'status' => 'APPROVED', 'password_hash' => null]);
    }

    public function testLowConfidenceApprovalIsDowngradedToReview(): void
    {
        $this->claude->queueText('{"decision":"APPROVED","confidence":0.6,"reasoning":"Probably fine.","red_flags":[]}');
        $input = $this->application('parent');

        $body = $this->body($this->api('post', 'applications', $input));

        $this->assertSame('NEEDS_REVIEW', $body['status']);
        $this->assertArrayNotHasKey('token', $body);
        $this->api('post', 'auth/login', ['email' => $input['email'], 'password' => $input['password']])->assertStatus(401);
    }

    public function testRejectedApplication(): void
    {
        $this->claude->queueText('{"decision":"REJECTED","confidence":0.1,"reasoning":"Test data.","red_flags":["gibberish","test data"]}');

        $body = $this->body($this->api('post', 'applications', $this->application()));

        $this->assertSame('REJECTED', $body['status']);
        $this->assertArrayNotHasKey('token', $body);
    }

    public function testAiFailureAndRefusalFailSafeToNeedsReview(): void
    {
        $this->claude->queueFailure();
        $this->assertSame('NEEDS_REVIEW', $this->body($this->api('post', 'applications', $this->application()))['status']);

        $this->claude->queueRefusal();
        $this->assertSame('NEEDS_REVIEW', $this->body($this->api('post', 'applications', $this->application()))['status']);

        $this->claude->queueText('I think this looks fine!');
        $this->assertSame('NEEDS_REVIEW', $this->body($this->api('post', 'applications', $this->application()))['status']);
    }

    public function testApplicantMustBeAnAdult(): void
    {
        $input        = $this->application();
        $input['dob'] = $this->dobForAge(16);

        $this->api('post', 'applications', $input)->assertStatus(422);
        $this->assertSame([], $this->claude->calls);
    }

    public function testAdminOverviewRequiresAdmin(): void
    {
        $student = $this->student();
        $teacher = $this->adult('teacher');

        $this->api('get', 'admin/overview')->assertStatus(401);
        $this->api('get', 'admin/overview', [], $student['token'])->assertStatus(403);
        $this->api('get', 'admin/overview', [], $teacher['token'])->assertStatus(403);
    }

    public function testAdminReviewsAndApprovesApplication(): void
    {
        $admin = $this->adult('admin');
        $this->claude->queueText('{"decision":"NEEDS_REVIEW","confidence":0.7,"reasoning":"Check school.","red_flags":["unverified school"]}');
        $input = $this->application();
        $this->api('post', 'applications', $input)->assertStatus(200);

        $overview = $this->body($this->api('get', 'admin/overview', [], $admin['token']));
        $app      = array_values(array_filter($overview['applications'], static fn (array $a): bool => $a['email'] === $input['email']))[0];
        foreach (['id', 'email', 'requested_role', 'dob', 'application_data', 'ai_decision', 'ai_confidence', 'ai_reasoning', 'ai_red_flags', 'admin_decision', 'admin_notes', 'status', 'created_at'] as $key) {
            $this->assertArrayHasKey($key, $app);
        }
        $this->assertArrayNotHasKey('password_hash', $app);
        $this->assertIsInt($app['id']);
        $this->assertSame(0.7, $app['ai_confidence']);
        $this->assertSame(['unverified school'], $app['ai_red_flags']);
        $this->assertSame('Nomsa', $app['application_data']['first_name']);
        $this->assertSame('NEEDS_REVIEW', $app['status']);

        $decided = $this->api('put', "admin/applications/{$app['id']}", ['status' => 'APPROVED', 'notes' => 'Verified by phone'], $admin['token']);
        $decided->assertStatus(200);
        $this->assertSame('APPROVED', $this->body($decided)['application']['admin_decision']);

        $login = $this->api('post', 'auth/login', ['email' => $input['email'], 'password' => $input['password']]);
        $login->assertStatus(200);
        $this->assertSame('teacher', $this->body($login)['profile']['role']);
    }

    public function testAdminCanReadAnySessionAndOverviewTypes(): void
    {
        $admin   = $this->adult('admin');
        $student = $this->student();
        $session = $this->body($this->api('post', 'chat/messages', ['subject' => 'Mathematics', 'content' => 'hi'], $student['token']))['session_id'];
        $this->api('post', 'feedback', ['rating' => 4, 'session_id' => $session], $student['token'])->assertStatus(201);

        $messages = $this->body($this->api('get', "admin/sessions/{$session}/messages", [], $admin['token']));
        $this->assertCount(3, $messages);

        $overview = $this->body($this->api('get', 'admin/overview', [], $admin['token']));
        $row      = array_values(array_filter($overview['sessions'], static fn (array $s): bool => $s['id'] === $session))[0];
        $this->assertSame(3, $row['message_count']);
        $this->assertSame($student['id'], $row['user_id']);
        $this->assertIsInt($overview['feedback'][0]['rating']);
        $this->assertIsInt($overview['profiles'][0]['id']);
    }
}
