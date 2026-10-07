<?php

declare(strict_types=1);

namespace App\Models;

/**
 * CAPS practice questions. model_answer is server-only — never returned to clients.
 */
class PracticeQuestionModel extends AuditableModel
{
    protected $table      = 'practice_questions';
    protected $primaryKey = 'id';
    protected $allowedFields = [
        'subject',
        'grade',
        'topic',
        'question_text',
        'question_hash',
        'model_answer',
        'marks',
        'difficulty',
    ];
    protected $validationRules = [
        'subject'       => 'required|max_length[100]',
        'grade'         => 'required|is_natural|greater_than_equal_to[8]|less_than_equal_to[12]',
        'topic'         => 'permit_empty|max_length[150]',
        'question_text' => 'required',
        'question_hash' => 'required|exact_length[64]',
        'model_answer'  => 'required',
        'marks'         => 'required|is_natural_no_zero|less_than_equal_to[50]',
        'difficulty'    => 'required|in_list[easy,medium,hard]',
    ];
    protected $validationMessages = [];
}
