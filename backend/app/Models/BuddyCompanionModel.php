<?php

declare(strict_types=1);

namespace App\Models;

/**
 * A student's companion ("buddy") state as JSON.
 */
class BuddyCompanionModel extends AuditableModel
{
    protected $table      = 'buddy_companions';
    protected $primaryKey = 'id';
    protected $allowedFields = [
        'user_id',
        'buddy_data',
    ];
    protected $validationRules = [
        'user_id'    => 'required|is_natural_no_zero',
        'buddy_data' => 'required|valid_json',
    ];
    protected $validationMessages = [];
}
