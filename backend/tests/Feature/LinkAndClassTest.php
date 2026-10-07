<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\Support\ApiTestCase;

/**
 * @internal
 */
final class LinkAndClassTest extends ApiTestCase
{
    public function testParentLinksWithStudentCodeAndSeesActivity(): void
    {
        $student = $this->student('Sipho', 11);
        $this->api('put', 'me/profile', ['last_name' => 'Dlamini'], $student['token'])->assertStatus(200);
        $parent = $this->adult('parent');

        $code = $this->api('post', 'link-codes', [], $student['token']);
        $code->assertStatus(201);
        $codeBody = $this->body($code);
        $this->assertMatchesRegularExpression('/^[A-Z0-9]{6}$/', $codeBody['code']);

        $link = $this->api('post', 'parent/links', ['code' => strtolower($codeBody['code'])], $parent['token']);
        $link->assertStatus(201);
        $this->assertSame(['id' => $student['id'], 'first_name' => 'Sipho', 'grade' => 11], $this->body($link)['student']);

        $students = $this->body($this->api('get', 'parent/students', [], $parent['token']));
        $this->assertSame([['id' => $student['id'], 'first_name' => 'Sipho', 'last_name' => 'Dlamini', 'grade' => 11, 'primary_subject' => 'Mathematics']], $students);

        $this->api('post', 'chat/messages', ['subject' => 'Mathematics', 'content' => 'hi'], $student['token'])->assertStatus(200);
        $activity = $this->body($this->api('get', "parent/students/{$student['id']}/activity", [], $parent['token']));
        $this->assertSame('Sipho', $activity['student']['first_name']);
        $this->assertCount(1, $activity['sessions']);
        $this->assertIsInt($activity['sessions'][0]['id']);

        // The code is single use.
        $other = $this->adult('parent');
        $this->api('post', 'parent/links', ['code' => $codeBody['code']], $other['token'])->assertStatus(400);
    }

    public function testParentCannotSeeUnlinkedStudent(): void
    {
        $student = $this->student();
        $parent  = $this->adult('parent');

        $this->api('get', "parent/students/{$student['id']}/activity", [], $parent['token'])->assertStatus(403);

        $bad = $this->api('post', 'parent/links', ['code' => 'ZZZZZZ'], $parent['token']);
        $bad->assertStatus(400);
        $this->assertSame("That code didn't work. Ask your child for a new code.", $this->body($bad)['error']);
        $this->api('post', 'parent/links', ['code' => 'ZZZZZZ'], $student['token'])->assertStatus(403);
    }

    public function testTeacherClassJoinActivityAndOwnership(): void
    {
        $teacher = $this->adult('teacher', 'Mrs Naidoo');
        $student = $this->student('Ayanda', 10);

        $created = $this->api('post', 'teacher/classes', ['name' => '10A Maths', 'subject' => 'Mathematics', 'grade' => 10], $teacher['token']);
        $created->assertStatus(201);
        $class = $this->body($created)['class'];
        $this->assertMatchesRegularExpression('/^[A-Z0-9]{8}$/', $class['join_code']);
        $this->assertSame(0, $class['student_count']);

        $join = $this->api('post', 'classes/join', ['code' => $class['join_code']], $student['token']);
        $join->assertStatus(201);
        $this->assertSame(['id' => $class['id'], 'name' => '10A Maths', 'subject' => 'Mathematics', 'grade' => 10, 'teacher_first_name' => 'Mrs Naidoo'], $this->body($join)['class']);
        $this->api('post', 'classes/join', ['code' => $class['join_code']], $student['token'])->assertStatus(200);

        $this->api('post', 'chat/messages', ['subject' => 'Mathematics', 'content' => 'hi'], $student['token'])->assertStatus(200);
        $activity = $this->body($this->api('get', "teacher/classes/{$class['id']}/activity", [], $teacher['token']));
        $this->assertSame($student['id'], $activity['students'][0]['id']);
        $this->assertSame($student['id'], $activity['sessions'][0]['user_id']);

        $list = $this->body($this->api('get', 'teacher/classes', [], $teacher['token']));
        $this->assertSame(1, $list[0]['student_count']);
        $this->assertSame($class['id'], $this->body($this->api('get', 'me/classes', [], $student['token']))[0]['id']);

        $other = $this->adult('teacher');
        $this->api('get', "teacher/classes/{$class['id']}/activity", [], $other['token'])->assertStatus(403);
        $this->api('delete', "teacher/classes/{$class['id']}", [], $other['token'])->assertStatus(403);
        $this->api('get', 'teacher/classes/99999999/activity', [], $teacher['token'])->assertStatus(404);

        $this->api('delete', "teacher/classes/{$class['id']}/students/{$student['id']}", [], $teacher['token'])->assertStatus(200);
        $this->assertSame([], $this->body($this->api('get', 'me/classes', [], $student['token'])));
    }

    public function testEnrolmentIsImpossibleWithoutTheStudentEnteringTheCode(): void
    {
        $teacher = $this->adult('teacher');
        $student = $this->student();
        $class   = $this->body($this->api('post', 'teacher/classes', ['name' => 'Science'], $teacher['token']))['class'];

        // Teachers cannot use the join endpoint, and there is no endpoint to add a student.
        $this->api('post', 'classes/join', ['code' => $class['join_code']], $teacher['token'])->assertStatus(403);
        $bad = $this->api('post', 'classes/join', ['code' => 'WRONG123'], $student['token']);
        $bad->assertStatus(400);
        $this->assertSame("That class code didn't work. Check it with your teacher.", $this->body($bad)['error']);
        $this->dontSeeInDatabase('class_enrollments', ['class_id' => $class['id']]);

        $this->api('post', 'classes/join', ['code' => $class['join_code']], $student['token'])->assertStatus(201);
        $this->api('delete', "me/classes/{$class['id']}", [], $student['token'])->assertStatus(200);
        $this->dontSeeInDatabase('class_enrollments', ['class_id' => $class['id']]);
        $this->api('delete', "teacher/classes/{$class['id']}", [], $teacher['token'])->assertStatus(200);
    }
}
