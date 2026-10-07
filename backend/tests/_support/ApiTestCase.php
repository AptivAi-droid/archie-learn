<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Database\Seeds\PracticeQuestionSeeder;
use App\Libraries\AccountService;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;
use CodeIgniter\Test\TestResponse;
use Config\Services;

/**
 * Base class for API feature tests: migrates every namespace (Shield + settings + app)
 * once against the MySQL `tests` group, seeds the question bank, and injects a fake Claude.
 */
abstract class ApiTestCase extends CIUnitTestCase
{
    use DatabaseTestTrait;
    use FeatureTestTrait;

    protected $migrate     = true;
    protected $migrateOnce = true;
    protected $refresh     = true;
    protected $namespace   = null;
    protected $seed        = PracticeQuestionSeeder::class;
    protected $seedOnce    = true;

    protected FakeClaudeClient $claude;

    private static int $sequence = 0;

    protected function setUp(): void
    {
        parent::setUp();

        $this->claude = new FakeClaudeClient();
        Services::injectMock('claude', $this->claude);
    }

    /**
     * Sends a JSON API request.
     *
     * @param string               $method  HTTP method
     * @param string               $path    Path below api/v1/
     * @param array<string, mixed> $body    JSON body (or query params for GET)
     * @param string|null          $token   Bearer token
     * @param array<string, string> $headers Extra headers
     */
    protected function api(string $method, string $path, array $body = [], ?string $token = null, array $headers = []): TestResponse
    {
        auth('tokens')->getAuthenticator()->logout();

        $headers += ['Accept' => 'application/json', 'Origin' => 'http://localhost:5173'];

        if ($token !== null) {
            $headers['Authorization'] = 'Bearer ' . $token;
        }

        $request = $this->withHeaders($headers);

        if (strtolower($method) !== 'get') {
            $request = $request->withBodyFormat('json');
        }

        return $request->call(strtolower($method), 'api/v1/' . ltrim($path, '/'), $body);
    }

    /**
     * Decodes a JSON response body.
     *
     * @return array<mixed>
     */
    protected function body(TestResponse $response): array
    {
        $decoded = json_decode((string) $response->response()->getBody(), true);

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * A unique email for this run.
     */
    protected function email(string $prefix = 'user'): string
    {
        return $prefix . '+' . (++self::$sequence) . '-' . bin2hex(random_bytes(3)) . '@example.co.za';
    }

    /**
     * Date of birth for someone of the given age today.
     */
    protected function dobForAge(int $years): string
    {
        return gmdate('Y-m-d', strtotime("-{$years} years -10 days"));
    }

    /**
     * Registers a student through the API and completes their profile.
     *
     * @return array{token: string, id: int, email: string}
     */
    protected function student(string $firstName = 'Thandi', int $grade = 10): array
    {
        $email    = $this->email('student');
        $response = $this->api('post', 'auth/register', ['email' => $email, 'password' => 'secret-pass-1', 'dob' => $this->dobForAge(15)]);
        $response->assertStatus(201);
        $data = $this->body($response);

        $this->api('put', 'me/profile', ['first_name' => $firstName, 'grade' => $grade, 'primary_subject' => 'Mathematics'], $data['token'])
            ->assertStatus(200);

        return ['token' => $data['token'], 'id' => $data['profile']['id'], 'email' => $email];
    }

    /**
     * Creates an adult account (teacher / parent / admin) directly and returns a token.
     *
     * @return array{token: string, id: int, email: string}
     */
    protected function adult(string $role, string $firstName = 'Sam'): array
    {
        $accounts = new AccountService();
        $email    = $this->email($role);
        $row      = $accounts->createAccount(['email' => $email, 'role' => $role, 'dob' => '1985-05-05', 'first_name' => $firstName], 'secret-pass-1');

        return ['token' => $accounts->issueToken((int) $row['user_id']), 'id' => (int) $row['user_id'], 'email' => $email];
    }
}
