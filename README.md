# Archie Learn

CAPS-aligned AI study partner for South African learners (Grades 8–12).

| Part | Stack | Docs |
|---|---|---|
| `backend/` | CodeIgniter 4.7 + Shield + MySQL 9.7, REST API (`/api/v1`) | [backend/README.md](backend/README.md) |
| `frontend/` | React 19 + Vite + Tailwind 4 web app | [frontend/.env.example](frontend/.env.example) |
| Contract | — | [docs/API.md](docs/API.md) |

## Run locally
```bash
cd backend && composer install && cp env .env   # then fill in .env (DB, ANTHROPIC_API_KEY)
php spark migrate --all && php spark db:seed PracticeQuestionSeeder && php spark serve
```
```bash
cd frontend && npm ci && npm run dev            # http://localhost:5173/archie-learn/
```

## CI
- `.github/workflows/backend.yml` — migrations + PHPUnit against MySQL 9.7.
- `.github/workflows/deploy.yml` — builds `frontend/` for GitHub Pages (`master` + `dev`).

Branches: `master` = production, `dev` = pilot/testing. Never commit `.env`.
