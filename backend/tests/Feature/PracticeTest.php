<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\Support\ApiTestCase;

/**
 * @internal
 */
final class PracticeTest extends ApiTestCase
{
    public function testQuestionsNeverExposeModelAnswer(): void
    {
        $student  = $this->student();
        $response = $this->api('get', 'practice/questions', ['subject' => 'Mathematics', 'grade' => '10', 'limit' => '3'], $student['token']);

        $response->assertStatus(200);
        $questions = $this->body($response);
        $this->assertNotEmpty($questions);
        $this->assertLessThanOrEqual(3, count($questions));

        foreach ($questions as $q) {
            $this->assertArrayNotHasKey('model_answer', $q);
            $this->assertSame(['id', 'subject', 'grade', 'topic', 'question_text', 'marks', 'difficulty'], array_keys($q));
            $this->assertIsInt($q['id']);
            $this->assertSame(10, $q['grade']);
            $this->assertIsInt($q['marks']);
        }

        $this->assertStringNotContainsString('model_answer', (string) $response->response()->getBody());
    }

    public function testSeederLoadedTheWholeQuestionBank(): void
    {
        $this->assertSame(92, $this->db->table('practice_questions')->countAllResults());
    }

    public function testAnswerIsMarkedServerSideClampedAndStored(): void
    {
        $student  = $this->student();
        $question = $this->db->table('practice_questions')->where(['subject' => 'Mathematics', 'grade' => 9])->get()->getRowArray();
        $this->claude->queueText('Here you go: {"score": 99, "feedback": "Spot on.", "encouragement": "Keep it up!"}');

        $response = $this->api('post', 'practice/answers', ['question_id' => (int) $question['id'], 'answer' => 'my answer'], $student['token']);

        $response->assertStatus(200);
        $body = $this->body($response);
        $this->assertSame((int) $question['marks'], $body['score']);
        $this->assertSame((int) $question['marks'], $body['max_marks']);
        $this->assertSame('Spot on.', $body['feedback']);
        $this->assertSame('Keep it up!', $body['encouragement']);

        $call = $this->claude->lastCall();
        $this->assertSame('claude-haiku-4-5', $call['model']);
        $this->assertStringContainsString($question['model_answer'], $call['messages'][0]['content']);

        $this->seeInDatabase('user_answers', ['user_id' => $student['id'], 'question_id' => $question['id'], 'ai_score' => $question['marks']]);
    }

    public function testNegativeScoreIsClampedToZero(): void
    {
        $student  = $this->student();
        $question = $this->db->table('practice_questions')->get(1)->getRowArray();
        $this->claude->queueText('{"score": -3, "feedback": "Not quite.", "encouragement": "Try again!"}');

        $body = $this->body($this->api('post', 'practice/answers', ['question_id' => (int) $question['id'], 'answer' => 'idk'], $student['token']));

        $this->assertSame(0, $body['score']);
    }

    public function testAiFailureIs502AndNothingStored(): void
    {
        $student  = $this->student();
        $question = $this->db->table('practice_questions')->get(1)->getRowArray();
        $this->claude->queueFailure();

        $this->api('post', 'practice/answers', ['question_id' => (int) $question['id'], 'answer' => 'x'], $student['token'])->assertStatus(502);
        $this->claude->queueText('not json at all');
        $this->api('post', 'practice/answers', ['question_id' => (int) $question['id'], 'answer' => 'x'], $student['token'])->assertStatus(502);
        $this->claude->queueRefusal();
        $this->api('post', 'practice/answers', ['question_id' => (int) $question['id'], 'answer' => 'x'], $student['token'])->assertStatus(502);

        $this->dontSeeInDatabase('user_answers', ['user_id' => $student['id']]);
    }

    public function testUnknownQuestionIs404(): void
    {
        $student = $this->student();

        $this->api('post', 'practice/answers', ['question_id' => 99999999, 'answer' => 'x'], $student['token'])->assertStatus(404);
    }

    public function testLessonViewsProgressAndBuddy(): void
    {
        $student = $this->student();

        $this->api('post', 'lessons/views', ['subject' => 'Mathematics', 'grade' => 10, 'topic_key' => 'Mathematics::10::Algebra'], $student['token'])
            ->assertStatus(201);
        $this->api('post', 'chat/messages', ['subject' => 'Mathematics', 'content' => 'hi'], $student['token'])->assertStatus(200);

        $progress = $this->body($this->api('get', 'progress', [], $student['token']));
        $this->assertSame('Mathematics::10::Algebra', $progress['lesson_views'][0]['topic_key']);
        $this->assertIsInt($progress['sessions'][0]['id']);
        $this->assertSame([], $progress['answers']);

        $this->assertSame(['buddy_data' => null], $this->body($this->api('get', 'buddy', [], $student['token'])));
        $this->api('put', 'buddy', ['buddy_data' => ['species' => 'owl', 'level' => 2]], $student['token'])->assertStatus(200);
        // MySQL JSON columns normalise key order, so compare keys/values/types, not order.
        $buddy = $this->body($this->api('get', 'buddy', [], $student['token']))['buddy_data'];
        ksort($buddy);
        $this->assertSame(['level' => 2, 'species' => 'owl'], $buddy);
        $this->api('put', 'buddy', ['buddy_data' => [1, 2, 3]], $student['token'])->assertStatus(422);
    }

    public function testFeedbackIsStored(): void
    {
        $student = $this->student();

        $this->api('post', 'feedback', ['rating' => 5, 'what_worked' => 'Clear hints'], $student['token'])->assertStatus(201);
        $this->api('post', 'feedback', ['rating' => 9], $student['token'])->assertStatus(422);
        $this->seeInDatabase('feedback', ['user_id' => $student['id'], 'rating' => 5]);
    }
}
