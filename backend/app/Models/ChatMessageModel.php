<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Messages within a tutor chat session.
 */
class ChatMessageModel extends AuditableModel
{
    protected $table      = 'chat_messages';
    protected $primaryKey = 'id';
    protected $allowedFields = [
        'session_id',
        'user_id',
        'role',
        'content',
    ];
    protected $validationRules = [
        'session_id' => 'required|is_natural_no_zero',
        'user_id'    => 'required|is_natural_no_zero',
        'role'       => 'required|in_list[user,assistant]',
        'content'    => 'required|max_length[16000]',
    ];
    protected $validationMessages = [];

    /** Learner-generated content is kept out of the immutable audit trail (POPIA erasure). */
    protected array $auditExclude = ['content'];
}
