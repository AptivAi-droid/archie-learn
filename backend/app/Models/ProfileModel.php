<?php

declare(strict_types=1);

namespace App\Models;

/**
 * One profile per Shield user (role + learner details). profiles.user_id → users.id.
 */
class ProfileModel extends AuditableModel
{
    protected $table      = 'profiles';
    protected $primaryKey = 'id';
    protected $allowedFields = [
        'user_id',
        'email',
        'role',
        'first_name',
        'last_name',
        'grade',
        'primary_subject',
        'subjects',
        'school',
        'dob',
        'companion',
    ];
    protected $validationRules = [
        'user_id'         => 'required|is_natural_no_zero',
        'email'           => 'required|valid_email|max_length[254]',
        'role'            => 'required|in_list[student,parent,teacher,admin]',
        'first_name'      => 'permit_empty|max_length[100]',
        'last_name'       => 'permit_empty|max_length[100]',
        'grade'           => 'permit_empty|is_natural|greater_than_equal_to[8]|less_than_equal_to[12]',
        'primary_subject' => 'permit_empty|max_length[100]',
        'subjects'        => 'permit_empty|valid_json',
        'school'          => 'permit_empty|max_length[150]',
        'dob'             => 'permit_empty|valid_date[Y-m-d]',
        'companion'       => 'permit_empty|max_length[50]',
    ];
    protected $validationMessages = [
        'role'  => [
            'in_list' => 'Role must be student, parent, teacher or admin.',
        ],
        'grade' => [
            'greater_than_equal_to' => 'Grade must be between 8 and 12.',
            'less_than_equal_to'    => 'Grade must be between 8 and 12.',
        ],
    ];
}
