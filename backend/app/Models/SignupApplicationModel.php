<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Teacher/parent applications, vetted by Claude and reviewed by admins.
 */
class SignupApplicationModel extends AuditableModel
{
    protected $table      = 'signup_applications';
    protected $primaryKey = 'id';
    protected $allowedFields = [
        'email',
        'requested_role',
        'dob',
        'application_data',
        'password_hash',
        'status',
        'ai_decision',
        'ai_confidence',
        'ai_reasoning',
        'ai_red_flags',
        'admin_decision',
        'admin_notes',
        'reviewed_by',
        'reviewed_at',
        'created_user_id',
        'ip_address',
    ];
    protected $validationRules = [
        'email'            => 'required|valid_email|max_length[254]',
        'requested_role'   => 'required|in_list[teacher,parent]',
        'dob'              => 'required|valid_date[Y-m-d]',
        'application_data' => 'required|valid_json',
        'password_hash'    => 'permit_empty|max_length[255]',
        'status'           => 'required|in_list[APPROVED,NEEDS_REVIEW,REJECTED]',
        'ai_decision'      => 'permit_empty|in_list[APPROVED,NEEDS_REVIEW,REJECTED]',
        'ai_confidence'    => 'permit_empty|decimal',
        'ai_reasoning'     => 'permit_empty|max_length[5000]',
        'ai_red_flags'     => 'permit_empty|valid_json',
        'admin_decision'   => 'permit_empty|in_list[APPROVED,REJECTED]',
        'admin_notes'      => 'permit_empty|max_length[2000]',
        'reviewed_by'      => 'permit_empty|is_natural_no_zero',
        'reviewed_at'      => 'permit_empty|valid_date[Y-m-d H:i:s]',
        'created_user_id'  => 'permit_empty|is_natural_no_zero',
        'ip_address'       => 'permit_empty|max_length[45]',
    ];
    protected $validationMessages = [];

    protected array $auditExclude = ['password_hash'];
}
