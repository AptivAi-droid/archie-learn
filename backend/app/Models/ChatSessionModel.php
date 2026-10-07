<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Tutor chat sessions (one subject each).
 */
class ChatSessionModel extends AuditableModel
{
    protected $table      = 'chat_sessions';
    protected $primaryKey = 'id';
    protected $allowedFields = [
        'user_id',
        'subject',
    ];
    protected $validationRules = [
        'user_id' => 'required|is_natural_no_zero',
        'subject' => 'required|max_length[100]',
    ];
    protected $validationMessages = [];
}
