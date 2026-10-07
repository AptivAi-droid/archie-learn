<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Parent ↔ student links (created only via a student link code).
 */
class ParentStudentLinkModel extends AuditableModel
{
    protected $table      = 'parent_student_links';
    protected $primaryKey = 'id';
    protected $allowedFields = [
        'parent_id',
        'student_id',
    ];
    protected $validationRules = [
        'parent_id'  => 'required|is_natural_no_zero',
        'student_id' => 'required|is_natural_no_zero',
    ];
    protected $validationMessages = [];
}
