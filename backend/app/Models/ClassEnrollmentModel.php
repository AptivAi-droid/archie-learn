<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Student membership of a teacher class.
 */
class ClassEnrollmentModel extends AuditableModel
{
    protected $table      = 'class_enrollments';
    protected $primaryKey = 'id';
    protected $allowedFields = [
        'class_id',
        'student_id',
    ];
    protected $validationRules = [
        'class_id'   => 'required|is_natural_no_zero',
        'student_id' => 'required|is_natural_no_zero',
    ];
    protected $validationMessages = [];
}
