<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Marked practice answers.
 */
class UserAnswerModel extends AuditableModel
{
    protected $table      = 'user_answers';
    protected $primaryKey = 'id';
    protected $allowedFields = [
        'user_id',
        'question_id',
        'answer_text',
        'ai_score',
        'ai_feedback',
        'max_marks',
        'answered_at',
    ];
    protected $validationRules = [
        'user_id'     => 'required|is_natural_no_zero',
        'question_id' => 'required|is_natural_no_zero',
        'answer_text' => 'required|max_length[3000]',
        'ai_score'    => 'permit_empty|is_natural',
        'ai_feedback' => 'permit_empty|max_length[5000]',
        'max_marks'   => 'required|is_natural_no_zero',
        'answered_at' => 'required|valid_date[Y-m-d H:i:s]',
    ];
    protected $validationMessages = [];

    /** Learner-generated content is kept out of the immutable audit trail (POPIA erasure). */
    protected array $auditExclude = ['answer_text', 'ai_feedback'];
}
