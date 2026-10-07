<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Short-lived codes a student gives a parent to link accounts.
 */
class LinkCodeModel extends AuditableModel
{
    protected $table      = 'link_codes';
    protected $primaryKey = 'id';
    protected $allowedFields = [
        'code',
        'student_id',
        'expires_at',
        'used_at',
    ];
    protected $validationRules = [
        'code'       => 'required|exact_length[6]|alpha_numeric',
        'student_id' => 'required|is_natural_no_zero',
        'expires_at' => 'required|valid_date[Y-m-d H:i:s]',
        'used_at'    => 'permit_empty|valid_date[Y-m-d H:i:s]',
    ];
    protected $validationMessages = [];
}
