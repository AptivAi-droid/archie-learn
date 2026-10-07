<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Single-use password reset tokens (only the SHA-256 hash is stored).
 */
class PasswordResetModel extends AuditableModel
{
    protected $table      = 'password_resets';
    protected $primaryKey = 'id';
    protected $allowedFields = [
        'user_id',
        'token_hash',
        'expires_at',
        'used_at',
    ];
    protected $validationRules = [
        'user_id'    => 'required|is_natural_no_zero',
        'token_hash' => 'required|exact_length[64]',
        'expires_at' => 'required|valid_date[Y-m-d H:i:s]',
        'used_at'    => 'permit_empty|valid_date[Y-m-d H:i:s]',
    ];
    protected $validationMessages = [];

    protected array $auditExclude = ['token_hash'];
}
