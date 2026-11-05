# Archie Learn production rebuild scope

## Objective
Rebuild the learner-facing application so every current user journey works as a cohesive, mobile-first front end, while keeping authentication, database, payment and production AI provider implementation replaceable behind an API boundary. The existing master branch remains unchanged.

## Parity scope

### Public and onboarding
- Welcome, learner sign-up and sign-in
- Password reset
- Adult teacher/parent application workflow
- Learner profile setup: name, grade, school and subjects
- Meet Archie and companion selection/naming

### Learner experience
- Archie tutor with subject switching, chat history, feedback/reporting and clear safeguarding copy
- CAPS lesson explorer for the existing bundled subjects/content
- Practice: question selection, learner response, feedback, retry and result history
- Progress: activity, practice performance and subject/topic progress

### Adult and operations views
- Parent linking and consent-aware learner progress view
- Teacher classes, invitations/enrolments, learner view and export
- Admin sign-in, application review, feedback triage, roles and minimum-necessary operational reporting

## Architecture rule: AI is a replaceable service
The browser never receives a model key, system prompt, trusted user identity or official answers. It calls only the following versioned endpoints:

```text
POST /v1/tutor/messages        { sessionId?, subject, message }
POST /v1/practice/submissions  { questionId, answer }
GET  /v1/lessons               ?grade=&subject=
GET  /v1/progress              ?period=
POST /v1/parent-links/redeem   { code }
```

Each endpoint derives the signed-in user from its server-side session token. The service owns: role checks, learner safety policy, rate limits, CAPS context, approved question/answer data, model selection, cost controls, moderation, audit events and persistence.

A development adapter may return clearly labelled fixture responses so screens can be built and accepted before the real backend is ready. It must never appear in a production build.

## Non-negotiable safety controls before public launch
1. Verified server-side identity and RBAC.
2. Parent/teacher relationship and consent model, with atomic one-time code redemption.
3. AI system policy and marking rubric held server-side only.
4. Rate limits, spend caps, allowlisted origins and monitoring.
5. Safeguarding/reporting route, transcript minimisation, audit logs and retention/deletion rules.
6. CAPS content QA, accessibility testing and mobile/low-data testing.

## Delivery sequence and acceptance tests

### Phase 1: working front-end shell
Deliver every route, responsive navigation, empty/loading/error states and fixture data.
**Accept when:** a learner can complete onboarding, browse lessons, submit practice and view progress without dead ends; parent, teacher and admin views have navigable working states.

### Phase 2: learner workflow and content
Wire lessons, practice and progress to typed client service interfaces with local fixtures.
**Accept when:** all 10 existing CAPS subject data packs render correctly; practice state and progress calculations are consistent.

### Phase 3: AI adapter
Build the tutor and marker against the endpoint contract, with a server-only policy pack and development simulator.
**Accept when:** no API key, system prompt, answer key or user ID can be supplied/trusted by the browser; simulated tutor responses work end-to-end.

### Phase 4: backend integration
Replace fixtures one endpoint at a time with authenticated services and production data.
**Accept when:** automated integration tests cover role access, parent linking, rate limits, tutor and marking integrity.

### Phase 5: launch gate
Run mobile, accessibility, safeguarding, security and content QA.
**Accept when:** evidence for every gate is recorded and a human signs off release.

## Current code to reuse carefully
- Route map and responsive screen structure.
- Bundled CAPS lesson packs under `src/data/caps/`.
- Visual design components and companion concept.

## Current code not to carry into production unchanged
- Any endpoint accepting `userId`, `system`, model answer or marks from the browser.
- Hidden local demo mode.
- Broad link-code reads/updates.
- Adult application handling that sends a plaintext password to a custom endpoint.
- CORS wildcard and fail-open rate limiting.
