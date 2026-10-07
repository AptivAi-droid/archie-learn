<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Lesson topics a student has opened.
 */
class LessonViewModel extends AuditableModel
{
    protected $table      = 'lesson_views';
    protected $primaryKey = 'id';
    protected $allowedFields = [
        'user_id',
        'subject',
        'grade',
        'topic_key',
    ];
    protected $validationRules = [
        'user_id'   => 'required|is_natural_no_zero',
        'subject'   => 'required|max_length[100]',
        'grade'     => 'required|is_natural|greater_than_equal_to[8]|less_than_equal_to[12]',
        'topic_key' => 'required|max_length[255]',
    ];
    protected $validationMessages = [];
}
