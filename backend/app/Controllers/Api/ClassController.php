<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Libraries\ClassActivityService;
use App\Libraries\ClassService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Teacher classes and student joining.
 */
class ClassController extends ApiController
{
    /**
     * GET /api/v1/teacher/classes
     *
     * @return ResponseInterface JSON response
     */
    public function index(): ResponseInterface
    {
        return $this->handle(fn (): array => [(new ClassService())->listForTeacher($this->userId())]);
    }

    /**
     * POST /api/v1/teacher/classes
     *
     * @return ResponseInterface JSON response
     */
    public function create(): ResponseInterface
    {
        return $this->handle(fn (): array => [(new ClassService())->create($this->userId(), $this->body()), 201]);
    }

    /**
     * DELETE /api/v1/teacher/classes/{id} (owner)
     *
     * @param int|string|null $id Class id
     * @return ResponseInterface JSON response
     */
    public function delete($id = null): ResponseInterface
    {
        return $this->handle(function () use ($id): array {
            (new ClassService())->delete($this->userId(), (int) $id);

            return [['ok' => true]];
        });
    }

    /**
     * GET /api/v1/teacher/classes/{id}/activity (owner)
     *
     * @param int $id Class id
     * @return ResponseInterface JSON response
     */
    public function activity(int $id): ResponseInterface
    {
        return $this->handle(fn (): array => [(new ClassActivityService())->activity($this->userId(), $id)]);
    }

    /**
     * DELETE /api/v1/teacher/classes/{id}/students/{studentId} (owner)
     *
     * @param int $id        Class id
     * @param int $studentId Student user id
     * @return ResponseInterface JSON response
     */
    public function removeStudent(int $id, int $studentId): ResponseInterface
    {
        return $this->handle(function () use ($id, $studentId): array {
            (new ClassService())->removeStudent($this->userId(), $id, $studentId);

            return [['ok' => true]];
        });
    }

    /**
     * POST /api/v1/classes/join (student) — 201 on join, 200 if already a member.
     *
     * @return ResponseInterface JSON response
     */
    public function join(): ResponseInterface
    {
        return $this->handle(function (): array {
            [$body, $created] = (new ClassService())->join($this->userId(), $this->body());

            return [$body, $created ? 201 : 200];
        });
    }
}
