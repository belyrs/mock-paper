# MockPaper

MockPaper is a full-stack mock question-paper generation platform built from the existing TanStack Start frontend and a new TypeScript/Express/PostgreSQL backend. It preserves the original frontend flow while replacing local mock persistence with real APIs, PostgreSQL storage, validation, deduplication, and production-ready Docker packaging.

## What Exists Now

### Frontend flows analysed and preserved

- Landing page and generation entry flow
- Login and signup
- Password reset request and reset completion
- Class selection
- Mode selection
- Paper configuration
- Paper generation
- Question review
- Question editing
- Single-question regeneration
- Full-paper regeneration
- Answer key and concept analysis
- Saved paper history
- Profile and user history

### Backend delivered

- Express REST API in TypeScript
- PostgreSQL persistence through TypeORM
- TypeORM migrations
- Cookie-based authentication with JWT
- Password hashing
- Password reset flow with `console`, `resend`, or `smtp` mail modes
- Question generation provider abstraction
- OpenAI-backed generation provider
- Historical-paper import pipeline
- Historical-analysis fallback mode when no dataset is imported
- Exact, normalized, lexical, and optional embedding-based duplicate detection
- Per-paper and per-question persistence
- Swagger UI at `/api-docs`
- Backend test suite

## Architecture

### Frontend

- Framework: TanStack Start + React + TypeScript
- State: React Query plus a lightweight local draft state for in-progress paper configuration
- API integration: `src/lib/api/client.ts`
- Shared app state: `src/context/app-state.tsx`
- Frontend routes:
  - `/`
  - `/login`
  - `/signup`
  - `/reset-password`
  - `/generate`
  - `/generate/class`
  - `/generate/mode`
  - `/generate/configure`
  - `/generate/paper`
  - `/profile`
  - `/history/$id`

### Backend

- Runtime: Node.js + Express + TypeScript
- ORM: TypeORM
- Database: PostgreSQL
- Main folders:
  - `backend/src/controllers`
  - `backend/src/services`
  - `backend/src/repositories`
  - `backend/src/entities`
  - `backend/src/dtos`
  - `backend/src/middleware`
  - `backend/src/migrations`

### Core persistent entities

- `User`
- `PasswordResetToken`
- `Paper`
- `Question`
- `GenerationRun`
- `HistoricalPaper`
- `HistoricalQuestion`

## Question Generation Design

### Provider abstraction

The backend uses a provider abstraction in `backend/src/services/generation/types.ts` so the generation engine is replaceable later.

- `OpenAiQuestionGenerationProvider`
- `MockQuestionGenerationProvider`

### Prompt behavior

The demo path uses a compact version of the supplied educational instruction set and dynamically fills it with:

- subject
- class level
- chapter
- subtopic
- target exams
- question count
- difficulty mix
- up to eight recent exact-question exclusions
- a historical summary only when imported data exists

For normal papers of up to 20 questions, each subject is generated in one
structured OpenAI request. A second request is made only to repair missing or
invalid slots.

### Historical analysis modes

The backend supports two analysis modes:

- `imported_dataset`
  - Used when historical papers have been imported through the admin API.
- `model_knowledge_fallback`
  - Used when no historical dataset is available yet.
  - This keeps the app working immediately instead of blocking generation.
  - The paper stores that fallback mode explicitly so the system does not pretend a local corpus was analysed.

### Deduplication pipeline

Before saving any generated question, the backend checks:

- schema validity
- required fields
- four-option MCQ shape
- valid correct option
- per-question schema and syllabus relevance
- deterministic difficulty-slot selection
- normalized text hash collisions
- exact duplicates within the paper and a bounded recent same-syllabus history

Semantic and structural similarity checks remain available for future strict
production mode, but are disabled in the default demo path because they add
latency and can reject otherwise usable papers.

Questions are always stored in PostgreSQL. They are never kept only in frontend state.

## Environment Variables

Both `.env` and `.env.example` are included at the project root.

### Important defaults

- `QUESTION_PROVIDER=openai`
  - This is the intended production path and uses the full educational prompt plus syllabus grounding.
  - If `OPENAI_API_KEY` is missing or the OpenAI request fails, the backend can fall back to a deterministic syllabus-grounded generator for supported topics instead of returning fake placeholder text.
- `DEMO_FAST_GENERATION=true`
  - Uses one generation call per subject for papers up to 20 questions.
  - Limits generation to one primary attempt and one targeted repair attempt.
  - Disables synchronous LLM review and semantic embeddings.
  - Reuses previously saved questions from the exact syllabus slice only when generation and repair cannot fill the paper.
- `MAIL_PROVIDER=console`
  - This keeps password reset working locally without requiring a real mail service.
- `DATABASE_SSL=false`
  - Keep this `false` for local Docker PostgreSQL.
  - Set it to `true` only when your production database requires SSL.

### OpenAI configuration

To use real AI generation, set:

```env
QUESTION_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-5.2
OPENAI_REQUEST_TIMEOUT_MS=60000
OPENAI_GENERATION_BATCH_SIZE=20
DEMO_FAST_GENERATION=true
QUESTION_GENERATION_MAX_ATTEMPTS=2
ACADEMIC_REVIEW_ENABLED=false
SEMANTIC_DEDUP_ENABLED=false
```

The specific API key variable used by the backend is:

- `OPENAI_API_KEY`

### Production authentication

When the frontend and backend use separate HTTPS origins, authenticated
browser requests require a cross-origin cookie. Keep the automatic policy
unless the deployment has a specific requirement:

```env
AUTH_COOKIE_SECURE=
AUTH_COOKIE_SAME_SITE=auto
TRUST_PROXY_HOPS=1
```

`auto` uses `SameSite=None; Secure` for HTTPS and `SameSite=Lax` for local
HTTP development. Cross-site HTTPS cookies are also partitioned so the session
remains scoped to the frontend site. `TRUST_PROXY_HOPS=1` is appropriate when
the backend is behind one trusted platform proxy, such as Railway. The frontend
must continue to use `credentials: "include"`, and `FRONTEND_URL` must exactly
match its public origin.

Railway supplies `PORT` automatically. The backend honors it whenever
`BACKEND_PORT` is not explicitly configured.

## Local Development

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npm run build
npm run dev
```

### Tests

```bash
cd backend
npm test
```

## Docker

The project is Dockerized end-to-end.

### Start the full stack

```bash
docker compose up --build
```

This starts:

- frontend
- backend
- PostgreSQL

### Default URLs

- Frontend: [http://localhost:3100](http://localhost:3100)
- Backend API: [http://localhost:4100/api](http://localhost:4100/api)
- Swagger UI: [http://localhost:4100/api-docs](http://localhost:4100/api-docs)

### Docker behavior

- PostgreSQL uses a persistent Docker volume
- PostgreSQL has a health check
- Backend waits for database readiness through both Compose health dependencies and retry-on-start logic
- Backend has an HTTP health check
- Frontend waits for the backend health check before starting

## API Overview

Swagger UI is available at `/api-docs`, and the most important endpoints are listed below.

### Authentication

#### `POST /api/auth/register`

- Auth required: No
- Body:

```json
{
  "name": "Ada Student",
  "email": "ada@example.com",
  "password": "supersecure123"
}
```

- Response:

```json
{
  "user": {
    "id": "uuid",
    "name": "Ada Student",
    "email": "ada@example.com",
    "role": "admin",
    "createdAt": "2026-08-24T00:00:00.000Z",
    "updatedAt": "2026-08-24T00:00:00.000Z"
  }
}
```

#### `POST /api/auth/login`

- Auth required: No
- Body:

```json
{
  "email": "ada@example.com",
  "password": "supersecure123"
}
```

#### `GET /api/auth/me`

- Auth required: Yes
- Response:

```json
{
  "user": {
    "id": "uuid",
    "name": "Ada Student",
    "email": "ada@example.com",
    "role": "admin",
    "createdAt": "2026-08-24T00:00:00.000Z",
    "updatedAt": "2026-08-24T00:00:00.000Z"
  }
}
```

#### `POST /api/auth/password-reset/request`

- Auth required: No
- Body:

```json
{
  "email": "ada@example.com"
}
```

- Response:

```json
{
  "message": "If an account exists for that email, a password reset flow has been started.",
  "reset": {
    "delivered": true,
    "previewUrl": "http://localhost:3000/reset-password?token=...",
    "previewToken": "..."
  }
}
```

#### `POST /api/auth/password-reset/confirm`

- Auth required: No
- Body:

```json
{
  "token": "reset-token",
  "password": "newsecurepassword"
}
```

### Papers

#### `GET /api/papers`

- Auth required: Yes
- Response: current user papers with embedded questions

#### `POST /api/papers/generate`

- Auth required: Yes
- Rate limited: Yes
- Body:

```json
{
  "title": "NEET Class 12 Genetics Practice",
  "exam": "NEET",
  "classLevel": "Class 12",
  "mode": "individual",
  "subjects": [
    {
      "subject": "Biology",
      "chapter": "Genetics",
      "subTopic": "Mendelian Inheritance",
      "numberOfQuestions": 10,
      "mix": {
        "Easy": 30,
        "Medium": 40,
        "Hard": 30
      }
    }
  ]
}
```

- Response:

```json
{
  "paper": {
    "id": "uuid",
    "title": "NEET Class 12 Genetics Practice",
    "exam": "NEET",
    "classLevel": "Class 12",
    "mode": "individual",
    "questionCount": 10,
    "historicalAnalysisMode": "model_knowledge_fallback",
    "questions": []
  }
}
```

#### `GET /api/papers/:paperId`

- Auth required: Yes
- Response: one paper with ordered questions

#### `PATCH /api/papers/:paperId`

- Auth required: Yes
- Body:

```json
{
  "title": "Updated paper title"
}
```

#### `DELETE /api/papers/:paperId`

- Auth required: Yes
- Behavior: soft delete

#### `POST /api/papers/:paperId/regenerate`

- Auth required: Yes
- Behavior: creates a fresh paper using the stored configuration

#### `PATCH /api/papers/:paperId/questions/:questionId`

- Auth required: Yes
- Body:

```json
{
  "text": "Updated question text",
  "options": ["A", "B", "C", "D"],
  "correctOption": "A",
  "difficulty": "Medium",
  "conceptTested": "Inheritance ratio interpretation",
  "commonMistake": "Confusing genotype and phenotype",
  "recommendedRemedialAction": "Practice Punnett square questions",
  "learningOutcome": "Interpret monohybrid cross results",
  "bloomsTaxonomyLevel": "Application",
  "sourceReference": null,
  "examRelevance": {
    "NEET": "High"
  }
}
```

#### `POST /api/papers/:paperId/questions/:questionId/regenerate`

- Auth required: Yes
- Behavior: replaces one persisted question inside the paper

### Historical papers

#### `GET /api/historical-papers/status`

- Auth required: Yes
- Response:

```json
{
  "totalImportedQuestions": 0,
  "isHistoricalDatasetAvailable": false
}
```

#### `POST /api/historical-papers/import`

- Auth required: Yes, admin only
- Purpose: bulk import structured historical question papers later

## Validation and Error Format

When validation or service errors occur, the API returns a structured payload:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": {
      "fieldErrors": {}
    }
  }
}
```

Common codes include:

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `INVALID_TOKEN`
- `EMAIL_ALREADY_IN_USE`
- `QUESTION_GENERATION_FAILED`
- `OPENAI_NOT_CONFIGURED`
- `OPENAI_REQUEST_FAILED`
- `OPENAI_REQUEST_TIMEOUT`
- `DUPLICATE_QUESTION`
- `PAPER_NOT_FOUND`

## Operational Notes

- No email verification is implemented.
- Password reset is implemented.
- The first registered account becomes `admin`.
- `DEFAULT_ADMIN_EMAIL` can also designate an admin account explicitly.
- Historical dataset import is optional at startup.
- When no imported archive exists, generation still works and stores `model_knowledge_fallback` in each generated paper.
- The backend now rejects placeholder-style generation output such as internal scenario tags or generic template wording before it reaches the frontend.
- The local deterministic fallback is intentionally limited to curated syllabus slices; unsupported topics should use a working OpenAI API key rather than fabricated offline content.

## Verification Completed

The current implementation has been verified with:

- frontend production build
- backend TypeScript build
- backend automated tests

If you want real OpenAI-backed generation next, the only required provider key is `OPENAI_API_KEY`.
