# Secure learning API release checklist

This release moves tutor messaging and AI marking to authenticated, versioned serverless endpoints. It must be released with human approval because it changes database access and learner AI traffic.

## Change summary

- `/api/v1/tutor/messages` creates and owns tutor sessions server-side.
- `/api/v1/practice/questions` returns learner-safe question fields only.
- `/api/v1/practice/submissions` retrieves the answer key server-side, marks the attempt, and stores the authoritative result.
- The browser no longer sends model answers, marks, system prompts, chat history or user IDs.
- The previous `/api/chat` and `/api/mark` functions return **410 Gone**.

## Required deployment configuration

Set these in the hosting provider, not in source control: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ALLOWED_ORIGINS`; optional model and rate-limit controls.

## Release sequence

1. Apply `supabase/migrations/20261105000000_secure_learning_api.sql`.
2. Configure the required server-side values in the deployment environment.
3. Deploy front end and Netlify functions together.
4. Run the secure API smoke test with a dedicated learner.
5. Review logs during the first live day.

## Important compatibility note

The supplied migration removes direct authenticated reads of `practice_questions` and learner-side writes to `user_answers`. Apply the migration and deploy the functions as one release unit; a partial rollout will make Practice unavailable.
