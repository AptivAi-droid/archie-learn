<?php

declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

/**
 * Per-user hourly request counters. Increments go through App\Libraries\RateLimiter (atomic upsert); operational data, not audited.
 */
class RateLimitModel extends Model
{
    protected $table      = 'rate_limits';
    protected $primaryKey = 'id';
    protected $returnType     = 'array';
    protected $useTimestamps  = true;
    protected $dateFormat     = 'datetime';
    protected $protectFields  = true;
    protected $allowedFields = [
        'user_id',
        'endpoint',
        'window_start',
        'request_count',
    ];
    protected $validationRules = [
        'user_id'       => 'required|is_natural_no_zero',
        'endpoint'      => 'required|max_length[50]',
        'window_start'  => 'required|valid_date[Y-m-d H:i:s]',
        'request_count' => 'required|is_natural',
    ];
    protected $validationMessages = [];
}
