<?php

declare(strict_types=1);

namespace App\Filters;

use App\Models\ProfileModel;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Restricts a route to one or more roles, read from profiles.role of the authenticated
 * user (never from the request). Must run after `api-auth`.
 *
 * Usage in Routes.php: ['filter' => ['api-auth', 'role:teacher']] or 'role:student,teacher'.
 */
class RoleFilter implements FilterInterface
{
    /**
     * Rejects with 401 (no user) or 403 (wrong role).
     *
     * @param RequestInterface  $request   Current request
     * @param list<string>|null $arguments Allowed roles
     * @return ResponseInterface|null Error response, or null to continue
     */
    public function before(RequestInterface $request, $arguments = null)
    {
        $userId = auth('tokens')->getAuthenticator()->getUser()?->id;

        if ($userId === null) {
            return service('response')->setStatusCode(401)->setJSON(['error' => 'Please log in again.']);
        }

        $profile = model(ProfileModel::class)->select('role')->where('user_id', (int) $userId)->first();
        $allowed = array_map('trim', (array) $arguments);

        if ($profile === null || ! in_array($profile['role'], $allowed, true)) {
            return service('response')->setStatusCode(403)->setJSON(['error' => "You don't have access to this."]);
        }

        return null;
    }

    /**
     * No post-processing.
     *
     * @param RequestInterface  $request   Current request
     * @param ResponseInterface $response  Current response
     * @param list<string>|null $arguments Unused
     */
    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null): void
    {
    }
}
