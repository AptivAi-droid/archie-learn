<?php

declare(strict_types=1);

namespace Config;

use CodeIgniter\Shield\Config\Auth as ShieldAuth;

/**
 * Shield configuration for Archie Learn.
 *
 * The API is stateless: every protected route authenticates with a Shield access token
 * (`Authorization: Bearer <token>`), so `tokens` is the default authenticator. Session
 * auth is not used (there are no server-rendered pages).
 */
class Auth extends ShieldAuth
{
    public string $defaultAuthenticator = 'tokens';

    /**
     * @var list<string>
     */
    public array $authenticationChain = ['tokens'];

    public bool $allowRegistration = false;

    public int $minimumPasswordLength = 8;
}
