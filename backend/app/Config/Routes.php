<?php

declare(strict_types=1);

use CodeIgniter\Router\RouteCollection;

/**
 * Archie Learn routes. Every route is explicit (auto-routing is off in Config\Routing).
 * Contract: docs/API.md.
 *
 * Filters: `api-auth` (Shield access token), `role:<roles>` (profiles.role),
 * `throttle:<bucket>` (per-IP, Config\Archie::$throttle). CORS is applied to api/* in Config\Filters.
 *
 * @var RouteCollection $routes
 */
$routes->get('/', 'Home::index');

// API-only backend: unknown routes answer in the JSON error shape.
$routes->set404Override('App\Controllers\Api\ErrorController::notFound');

// CORS preflight: answered by the cors filter (204) before any auth filter can run.
$routes->options('api/(:any)', static function (): void {
});

$routes->group('api/v1', ['namespace' => 'App\Controllers\Api'], static function (RouteCollection $routes): void {
    $routes->get('health', 'HealthController::index');

    // Public, throttled per IP
    $routes->post('auth/register', 'AuthController::register', ['filter' => 'throttle:auth']);
    $routes->post('auth/login', 'AuthController::login', ['filter' => 'throttle:auth']);
    $routes->post('auth/password/forgot', 'PasswordController::forgot', ['filter' => 'throttle:auth']);
    $routes->post('auth/password/reset', 'PasswordController::reset', ['filter' => 'throttle:auth']);
    $routes->post('applications', 'ApplicationController::create', ['filter' => 'throttle:applications']);

    // Any signed-in user
    $routes->group('', ['filter' => 'api-auth'], static function (RouteCollection $routes): void {
        $routes->post('auth/logout', 'AuthController::logout');
        $routes->get('me', 'MeController::profile');
        $routes->put('me/profile', 'MeController::updateProfile');
        $routes->put('me/password', 'PasswordController::change');
        $routes->post('feedback', 'FeedbackController::create');
    });

    // Students
    $routes->group('', ['filter' => ['api-auth', 'role:student']], static function (RouteCollection $routes): void {
        $routes->post('chat/messages', 'ChatController::send');
        $routes->get('chat/sessions/(:num)/messages', 'ChatController::messages/$1');
        $routes->get('practice/questions', 'PracticeController::questions');
        $routes->post('practice/answers', 'PracticeController::answer');
        $routes->post('lessons/views', 'LearningController::lessonView');
        $routes->get('progress', 'LearningController::progress');
        $routes->get('buddy', 'LearningController::buddy');
        $routes->put('buddy', 'LearningController::saveBuddy');
        $routes->post('link-codes', 'LinkController::createCode');
        $routes->get('me/classes', 'MeController::classes');
        $routes->delete('me/classes/(:num)', 'MeController::leaveClass/$1');
    });
    $routes->post('classes/join', 'ClassController::join', ['filter' => ['throttle:linking', 'api-auth', 'role:student']]);

    // Parents
    $routes->post('parent/links', 'LinkController::link', ['filter' => ['throttle:linking', 'api-auth', 'role:parent']]);
    $routes->group('parent', ['filter' => ['api-auth', 'role:parent']], static function (RouteCollection $routes): void {
        $routes->get('students', 'LinkController::students');
        $routes->get('students/(:num)/activity', 'LinkController::activity/$1');
    });

    // Teachers
    $routes->group('teacher', ['filter' => ['api-auth', 'role:teacher']], static function (RouteCollection $routes): void {
        $routes->get('classes', 'ClassController::index');
        $routes->post('classes', 'ClassController::create');
        $routes->delete('classes/(:num)', 'ClassController::delete/$1');
        $routes->get('classes/(:num)/activity', 'ClassController::activity/$1');
        $routes->delete('classes/(:num)/students/(:num)', 'ClassController::removeStudent/$1/$2');
    });

    // Admins (promoted only via `php spark archie:make-admin`)
    $routes->group('admin', ['filter' => ['api-auth', 'role:admin']], static function (RouteCollection $routes): void {
        $routes->get('overview', 'AdminController::overview');
        $routes->get('sessions/(:num)/messages', 'AdminController::sessionMessages/$1');
        $routes->put('applications/(:num)', 'AdminController::decideApplication/$1');
    });
});
