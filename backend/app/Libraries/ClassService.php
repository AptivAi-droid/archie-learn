<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Models\ClassEnrollmentModel;
use App\Models\ProfileModel;
use App\Models\TeacherClassModel;
use RuntimeException;

/**
 * Teacher classes. A student can only be enrolled by entering the class code themselves
 * (their consent) — teachers cannot add students.
 */
class ClassService
{
    private const BAD_CODE = "That class code didn't work. Check it with your teacher.";

    /**
     * Classes owned by a teacher, with student counts.
     *
     * @param int $teacherId Teacher
     * @return list<array<string, mixed>>
     */
    public function listForTeacher(int $teacherId): array
    {
        $rows = model(TeacherClassModel::class)
            ->select('teacher_classes.*, COUNT(class_enrollments.id) AS student_count', false)
            ->join('class_enrollments', 'class_enrollments.class_id = teacher_classes.id', 'left')
            ->where('teacher_classes.teacher_id', $teacherId)
            ->groupBy('teacher_classes.id')
            ->orderBy('teacher_classes.created_at', 'DESC')
            ->findAll();

        return array_map(static fn (array $c): array => self::formatClass($c), $rows);
    }

    /**
     * Creates a class with a unique 8-character join code.
     *
     * @param int                  $teacherId Teacher
     * @param array<string, mixed> $input     { name, subject?, grade? }
     * @return array{class: array<string, mixed>}
     * @throws ApiException 422 on invalid input
     */
    public function create(int $teacherId, array $input): array
    {
        InputValidator::check($input, [
            'name'    => 'required|max_length[100]',
            'subject' => 'permit_empty|max_length[100]',
            'grade'   => 'permit_empty|is_natural|greater_than_equal_to[8]|less_than_equal_to[12]',
        ], ['name' => ['required' => 'Give your class a name.']]);

        $name = Format::cleanText((string) $input['name']);

        if ($name === '') {
            throw ApiException::validation(['name' => 'Give your class a name.']);
        }

        $model = model(TeacherClassModel::class);
        $id    = $this->insertWithUniqueCode($model, [
            'teacher_id' => $teacherId,
            'name'       => $name,
            'subject'    => InputValidator::optionalString($input, 'subject'),
            'grade'      => Format::intOrNull($input['grade'] ?? null),
        ]);

        return ['class' => self::formatClass($model->find($id) + ['student_count' => 0])];
    }

    /**
     * Deletes a class the teacher owns (its enrollments are removed first, audited).
     *
     * @param int $teacherId Teacher
     * @param int $classId   Class
     * @throws ApiException 404/403
     */
    public function delete(int $teacherId, int $classId): void
    {
        $this->ownedClass($teacherId, $classId);
        $enrollments = model(ClassEnrollmentModel::class);

        foreach ($enrollments->where('class_id', $classId)->findAll() as $row) {
            $enrollments->delete((int) $row['id']);
        }

        model(TeacherClassModel::class)->delete($classId);
    }

    /**
     * Removes a student from a class the teacher owns.
     *
     * @param int $teacherId Teacher
     * @param int $classId   Class
     * @param int $studentId Student
     * @throws ApiException 404/403
     */
    public function removeStudent(int $teacherId, int $classId, int $studentId): void
    {
        $this->ownedClass($teacherId, $classId);
        $this->deleteEnrollment($classId, $studentId);
    }

    /**
     * Student joins a class by code. Returns [body, created?].
     *
     * @param int                  $studentId Student
     * @param array<string, mixed> $input     { code }
     * @return array{0: array{class: array<string, mixed>}, 1: bool}
     * @throws ApiException 400 for a bad code
     */
    public function join(int $studentId, array $input): array
    {
        $code  = is_string($input['code'] ?? null) ? strtoupper(trim($input['code'])) : '';
        $class = preg_match('/^[A-Z0-9]{8}$/', $code) === 1
            ? model(TeacherClassModel::class)->where('join_code', $code)->first()
            : null;

        if ($class === null) {
            throw new ApiException(self::BAD_CODE, 400);
        }

        $enrollments = model(ClassEnrollmentModel::class);
        $existing    = $enrollments->where(['class_id' => (int) $class['id'], 'student_id' => $studentId])->first();

        if ($existing === null && $enrollments->insert(['class_id' => (int) $class['id'], 'student_id' => $studentId]) === false) {
            log_message('error', '[ClassService::join] ' . implode(', ', $enrollments->errors()));

            throw new RuntimeException('Enrollment insert failed.');
        }

        return [['class' => $this->studentView($class)], $existing === null];
    }

    /**
     * Classes the student belongs to.
     *
     * @param int $studentId Student
     * @return list<array<string, mixed>>
     */
    public function listForStudent(int $studentId): array
    {
        $rows = model(TeacherClassModel::class)
            ->select('teacher_classes.*')
            ->join('class_enrollments', 'class_enrollments.class_id = teacher_classes.id')
            ->where('class_enrollments.student_id', $studentId)
            ->orderBy('teacher_classes.name', 'ASC')->findAll();

        return array_map(fn (array $c): array => $this->studentView($c), $rows);
    }

    /**
     * Student leaves a class.
     *
     * @param int $studentId Student
     * @param int $classId   Class
     * @throws ApiException 404 when not enrolled
     */
    public function leave(int $studentId, int $classId): void
    {
        $this->deleteEnrollment($classId, $studentId);
    }

    /**
     * API shape of a class for its teacher.
     *
     * @param array<string, mixed> $c teacher_classes row (+ student_count)
     * @return array<string, mixed>
     */
    private static function formatClass(array $c): array
    {
        return [
            'id'            => (int) $c['id'],
            'name'          => $c['name'],
            'subject'       => $c['subject'],
            'grade'         => Format::intOrNull($c['grade']),
            'join_code'     => $c['join_code'],
            'student_count' => (int) ($c['student_count'] ?? 0),
            'created_at'    => Format::iso($c['created_at']),
        ];
    }

    /**
     * API shape of a class for a student (no join code).
     *
     * @param array<string, mixed> $c teacher_classes row
     * @return array<string, mixed>
     */
    private function studentView(array $c): array
    {
        $teacher = model(ProfileModel::class)->select('first_name')->where('user_id', (int) $c['teacher_id'])->first();

        return [
            'id'                 => (int) $c['id'],
            'name'               => $c['name'],
            'subject'            => $c['subject'],
            'grade'              => Format::intOrNull($c['grade']),
            'teacher_first_name' => $teacher['first_name'] ?? null,
        ];
    }

    /**
     * Loads a class and checks ownership.
     *
     * @param int $teacherId Teacher
     * @param int $classId   Class
     * @return array<string, mixed> Class row
     * @throws ApiException 404 missing, 403 not owner
     */
    public function ownedClass(int $teacherId, int $classId): array
    {
        $class = model(TeacherClassModel::class)->find($classId);

        if ($class === null) {
            throw new ApiException('Class not found.', 404);
        }

        if ((int) $class['teacher_id'] !== $teacherId) {
            throw new ApiException("That class isn't yours.", 403);
        }

        return $class;
    }

    /**
     * Deletes one enrollment by (class, student).
     *
     * @param int $classId   Class
     * @param int $studentId Student
     * @throws ApiException 404 when not enrolled
     */
    private function deleteEnrollment(int $classId, int $studentId): void
    {
        $model = model(ClassEnrollmentModel::class);
        $row   = $model->where(['class_id' => $classId, 'student_id' => $studentId])->first();

        if ($row === null) {
            throw new ApiException('That learner is not in this class.', 404);
        }

        $model->delete((int) $row['id']);
    }

    /**
     * Inserts a class, regenerating the join code on collision.
     *
     * @param TeacherClassModel    $model Model
     * @param array<string, mixed> $row   Values without join_code
     * @return int New class id
     */
    private function insertWithUniqueCode(TeacherClassModel $model, array $row): int
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $code = Format::randomCode(8);

            if ($model->where('join_code', $code)->countAllResults() === 0) {
                $id = $model->insert($row + ['join_code' => $code], true);

                if ($id === false) {
                    throw new RuntimeException('Class insert failed: ' . implode(', ', $model->errors()));
                }

                return (int) $id;
            }
        }

        throw new RuntimeException('Could not generate a unique class code.');
    }
}
