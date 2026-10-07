# Archie Learn — REST API (CodeIgniter 4.7 + Shield + MySQL)

The backend for Archie Learn. The contract with the web app is [`../docs/API.md`](../docs/API.md).

- **Framework:** CodeIgniter 4.7 (approved exception to the 4.4 baseline — 4.4 has unpatched advisories), PHP 8.2+
- **Auth:** CodeIgniter Shield access tokens (`Authorization: Bearer <token>`); roles live on `profiles.role`
- **Database:** MySQL 8.x / 9.x, InnoDB, `utf8mb4_unicode_ci`
- **AI:** Claude via raw HTTP (`app/Libraries/ClaudeClient.php`, CI4 CURLRequest) — tutoring and vetting on
  `claude-sonnet-5-5` (effort `low`, server-side refusal fallback), marking on `claude-haiku-4-5`

## Layout

```
app/
  Commands/MakeAdmin.php          php spark archie:make-admin <email>
  Config/Archie.php               app settings from .env (rate limits, models, throttle buckets)
  Config/Routes.php               every route, explicit (auto-routing off)
  Controllers/Api/                thin controllers (ApiController base: JSON + error shape)
  Database/Migrations/            one migration per table
  Database/Seeds/                 PracticeQuestionSeeder (92 CAPS questions) + DatabaseSeeder
  Filters/                        ApiAuthFilter (api-auth), RoleFilter (role:…), ThrottleFilter (throttle:…)
  Libraries/                      services: Auth, PasswordReset, Profile, Tutor, Practice, Learning,
                                  Link, Class, ClassActivity, Feedback, Application, Vetting, Admin,
                                  RateLimiter, ClaudeClient, Prompts (all prompts, incl. safeguarding)
  Models/                         one model per table; AuditableModel writes audit_log on every write
tests/Feature/                    API feature tests (MySQL), tests/unit/ (no DB)
```

## Local setup

```bash
cd backend
composer install
cp .env.example .env              # then edit: CI_ENVIRONMENT=development, DB creds, ANTHROPIC_API_KEY
php spark key:generate
php spark migrate --all           # Shield + settings + app tables
php spark db:seed DatabaseSeeder  # practice question bank
php spark serve                   # http://localhost:8080/api/v1/health
```

Promote an admin (admins cannot self-register): register/apply normally, then
`php spark archie:make-admin you@example.co.za`.

Password-reset emails: set the `email.*` SMTP values. With `email.fromEmail` empty and
`CI_ENVIRONMENT = development`, the reset link is written to `writable/logs/` instead.

## Tests

The feature suite needs a MySQL database it may wipe (default `archie_test` on `127.0.0.1:3306`,
user `root` / `root` — see `phpunit.dist.xml`; override with env vars `database.tests.hostname`,
`database.tests.database`, `database.tests.username`, `database.tests.password`, `database.tests.port`).

```bash
docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=archie_test mysql:8.4
composer test                     # or: php spark test / vendor/bin/phpunit
vendor/bin/phpunit tests/unit     # DB-free tests only
```

Claude is never called by tests: `Tests\Support\FakeClaudeClient` is injected with
`Services::injectMock('claude', $fake)`.

## cPanel deployment

1. **Build locally (or in CI):** `composer install --no-dev --optimize-autoloader`.
2. **Upload** the whole `backend/` folder (including `vendor/`) to e.g. `/home/<user>/archie-api/`.
   Nothing except `public/` may be web-accessible.
3. **Document root:** point the API (sub)domain at `/home/<user>/archie-api/public/`.
   `public/.htaccess` (shipped with CI4) routes everything to `index.php` — don't remove it.
4. **PHP:** select PHP 8.2+ with `intl`, `mbstring`, `mysqli`, `curl`, `json` enabled; `display_errors = Off`.
5. **Database:** in cPanel → MySQL Databases create the database (e.g. `cpuser_archie`) and **two** users:
   `cpuser_archie_owner` (ALL PRIVILEGES — used only to run migrations) and `cpuser_archie_app` (runtime,
   goes in `.env`). Give the runtime user no privileges in cPanel's UI; after step 7, grant it per table
   (phpMyAdmin → SQL) so `audit_log` is append-only at the database level:
   ```sql
   -- 1. Generate grants for every table except audit_log, then run the statements this returns:
   SELECT CONCAT('GRANT SELECT, INSERT, UPDATE, DELETE ON `', table_schema, '`.`', table_name,
                 '` TO ''cpuser_archie_app''@''localhost'';')
   FROM information_schema.tables
   WHERE table_schema = 'cpuser_archie' AND table_name <> 'audit_log';
   -- 2. The audit log: read and append only.
   GRANT SELECT, INSERT ON `cpuser_archie`.`audit_log` TO 'cpuser_archie_app'@'localhost';
   ```
   Re-run step 1 after any migration that adds a table. The application itself never updates or deletes
   `audit_log` (`AuditLogModel` throws); the grant makes it a database guarantee.
6. **Environment:** create `.env` from `.env.example` (`CI_ENVIRONMENT = production`, `app.baseURL`,
   DB creds, `cors.allowedOrigins`, `FRONTEND_URL`, `ANTHROPIC_API_KEY`, SMTP) and `chmod 600 .env`.
7. **Migrate + seed** (cPanel Terminal or SSH) with the *owner* DB user temporarily in `.env`:
   `php spark migrate --all` then `php spark db:seed DatabaseSeeder`. Switch `.env` back to the runtime
   user and apply the grants from step 5.
8. **Permissions:** `chmod -R 755 writable/` (the web user must be able to write logs/cache).
9. **Check:** `GET https://<api-domain>/api/v1/health` → `{"ok":true,"db":true,"version":"1"}`; check
   `writable/logs/` after the first request.

## Environment reference

| Variable | Purpose | Default |
|---|---|---|
| `CI_ENVIRONMENT` | `production` / `development` | production |
| `app.baseURL` | Public API URL (trailing slash) | `http://localhost:8080/` |
| `app.forceGlobalSecureRequests` | Redirect HTTP→HTTPS | false |
| `database.default.*` | hostname, database, username, password, DBDriver (`MySQLi`), port | — |
| `database.tests.*` | Test DB (PHPUnit only) | see phpunit.dist.xml |
| `cors.allowedOrigins` | Comma-separated frontend origins | `http://localhost:5173` |
| `FRONTEND_URL` | Web app base URL for reset links | `http://localhost:5173/` |
| `ANTHROPIC_API_KEY` | Claude API key | — (AI calls fail → 502 / NEEDS_REVIEW) |
| `ANTHROPIC_BASE_URL`, `CLAUDE_TIMEOUT` | API host, timeout seconds | api.anthropic.com, 60 |
| `CHAT_RATE_LIMIT` / `MARK_RATE_LIMIT` | Per-learner per-hour limits | 30 / 60 |
| `THROTTLE_AUTH_PER_MINUTE` | Login/register/reset attempts per IP per minute | 10 |
| `TOKEN_LIFETIME_DAYS` | Access-token lifetime | 30 |
| `email.fromEmail`, `email.fromName`, `email.protocol`, `email.SMTPHost`, `email.SMTPUser`, `email.SMTPPass`, `email.SMTPPort`, `email.SMTPCrypto` | Outgoing mail | sending disabled |
| `encryption.key` | `php spark key:generate` | — |
| `logger.threshold` | 4 in production | 4 |

## Notes

- Shield's `users.id` is `INT UNSIGNED`, so every column referencing a user is `INT UNSIGNED` (FK types
  must match); all other primary keys are `BIGINT UNSIGNED`.
- CSRF is enabled globally except for `api/*`: the API authenticates with bearer tokens, sends no auth
  cookies and serves no forms, so there is no ambient credential for a cross-site request to ride.
- `RateLimiter` uses one raw `INSERT … ON DUPLICATE KEY UPDATE` (documented in code) for an atomic counter.
- `rate_limits` is operational data and is not audited; every other app table is.
