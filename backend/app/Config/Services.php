<?php

declare(strict_types=1);

namespace Config;

use App\Libraries\Claude\ClaudeClientInterface;
use App\Libraries\ClaudeClient;
use CodeIgniter\Config\BaseService;

/**
 * Services Configuration file.
 *
 * Services are simply other classes/libraries that the system uses
 * to do its job. This is used by CodeIgniter to allow the core of the
 * framework to be swapped out easily without affecting the usage within
 * the rest of your application.
 *
 * This file holds any application-specific services, or service overrides
 * that you might need. An example has been included with the general
 * method format you should use for your service methods. For more examples,
 * see the core Services file at system/Config/Services.php.
 */
class Services extends BaseService
{
    /**
     * The Claude Messages API client. Tests replace it with
     * Services::injectMock('claude', $fake).
     *
     * @param bool $getShared Return the shared instance
     */
    public static function claude(bool $getShared = true): ClaudeClientInterface
    {
        if ($getShared) {
            return static::getSharedInstance('claude');
        }

        return new ClaudeClient(config(Archie::class));
    }
}
