<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Learner feedback on Archie.
 */
class FeedbackModel extends AuditableModel
{
    protected $table      = 'feedback';
    protected $primaryKey = 'id';
    protected $allowedFields = [
        'user_id',
        'session_id',
        'rating',
        'what_worked',
        'what_frustrated',
    ];
    protected $validationRules = [
        'user_id'         => 'required|is_natural_no_zero',
        'session_id'      => 'permit_empty|is_natural_no_zero',
        'rating'          => 'required|is_natural_no_zero|less_than_equal_to[5]',
        'what_worked'     => 'permit_empty|max_length[2000]',
        'what_frustrated' => 'permit_empty|max_length[2000]',
    ];
    protected $validationMessages = [];
}
