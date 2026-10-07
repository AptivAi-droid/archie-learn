<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Classes owned by a teacher; students join with join_code.
 */
class TeacherClassModel extends AuditableModel
{
    protected $table      = 'teacher_classes';
    protected $primaryKey = 'id';
    protected $allowedFields = [
        'teacher_id',
        'name',
        'subject',
        'grade',
        'join_code',
    ];
    protected $validationRules = [
        'teacher_id' => 'required|is_natural_no_zero',
        'name'       => 'required|min_length[1]|max_length[100]',
        'subject'    => 'permit_empty|max_length[100]',
        'grade'      => 'permit_empty|is_natural|greater_than_equal_to[8]|less_than_equal_to[12]',
        'join_code'  => 'required|exact_length[8]|alpha_numeric',
    ];
    protected $validationMessages = [];
}
