<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Models\ChatSessionModel;
use App\Models\ClassEnrollmentModel;
use App\Models\UserAnswerModel;

/**
 * Read-only activity reporting for a teacher's class (last 30 days).
 */
class ClassActivityService
{
    /**
     * @param ClassService $classes Ownership checks
     */
    public function __construct(private readonly ClassService $classes = new ClassService())
    {
    }

    /**
     * Students, sessions and answers of a class for the last 30 days.
     *
     * @param int $teacherId Teacher
     * @param int $classId   Class
     * @return array{students: list<array<string, mixed>>, sessions: list<array<string, mixed>>, answers: list<array<string, mixed>>}
     * @throws ApiException 404/403
     */
    public function activity(int $teacherId, int $classId): array
    {
        $this->classes->ownedClass($teacherId, $classId);

        $students = model(ClassEnrollmentModel::class)
            ->select('profiles.user_id, profiles.first_name, profiles.last_name, profiles.grade, profiles.primary_subject')
            ->join('profiles', 'profiles.user_id = class_enrollments.student_id')
            ->where('class_enrollments.class_id', $classId)
            ->orderBy('profiles.first_name', 'ASC')->findAll();
        $ids   = array_map(static fn (array $s): int => (int) $s['user_id'], $students);
        $since = Format::now('-30 days');

        return [
            'students' => array_map(static fn (array $s): array => [
                'id'              => (int) $s['user_id'],
                'first_name'      => $s['first_name'],
                'last_name'       => $s['last_name'],
                'grade'           => Format::intOrNull($s['grade']),
                'primary_subject' => $s['primary_subject'],
            ], $students),
            'sessions' => $ids === [] ? [] : $this->classSessions($ids, $since),
            'answers'  => $ids === [] ? [] : $this->classAnswers($ids, $since),
        ];
    }

    /**
     * Sessions of the given students since a date.
     *
     * @param list<int> $ids   Student ids
     * @param string    $since DATETIME
     * @return list<array<string, mixed>>
     */
    private function classSessions(array $ids, string $since): array
    {
        $rows = model(ChatSessionModel::class)->select('user_id, subject, created_at')
            ->whereIn('user_id', $ids)->where('created_at >=', $since)->orderBy('created_at', 'DESC')->findAll();

        return array_map(static fn (array $s): array => [
            'user_id' => (int) $s['user_id'], 'subject' => $s['subject'], 'created_at' => Format::iso($s['created_at']),
        ], $rows);
    }

    /**
     * Answers of the given students since a date.
     *
     * @param list<int> $ids   Student ids
     * @param string    $since DATETIME
     * @return list<array<string, mixed>>
     */
    private function classAnswers(array $ids, string $since): array
    {
        $rows = model(UserAnswerModel::class)->select('user_id, ai_score, max_marks, answered_at')
            ->whereIn('user_id', $ids)->where('answered_at >=', $since)->orderBy('answered_at', 'DESC')->findAll();

        return array_map(static fn (array $a): array => [
            'user_id'     => (int) $a['user_id'],
            'ai_score'    => Format::intOrNull($a['ai_score']),
            'max_marks'   => (int) $a['max_marks'],
            'answered_at' => Format::iso($a['answered_at']),
        ], $rows);
    }
}
