# Console redesign — October 19, 2026

## Implemented

The interface now uses a unified charcoal and warm-orange design system: a responsive workspace shell, grouped navigation, project switching, a searchable page picker (Ctrl/Cmd+K), a new sign-in/register screen, and a database-backed overview. Shared surfaces also update the existing traces, datasets, evaluations, comparison, RAG, API-key, and settings screens.

Dashboard controls select 1, 7, 30, or 90 days. Recent traces are explicitly labeled all-time; summary metrics and request activity use the selected range. Empty and failed requests have different UI states. No sample telemetry is inserted by the interface. Request chart bars and model distribution use the API response, with per-day values available on hover. Cost is always labeled estimated.

Native modal dialogs provide focus containment and Escape dismissal. Mobile navigation uses a drawer, tables scroll within their panels, and reduced-motion preferences are respected. Trace links initialize the explorer's URL filters. Expired API sessions return to sign-in.

The frontend uses `/api/v1` by default. Vite proxies `/api` to the local backend; the existing Nginx configuration does the equivalent in Docker. An optional `VITE_API_BASE_URL` in `frontend/.env.local` supports a separate API host. This is a public URL, never a secret. Restart Vite after changing it.

## Local launch (PowerShell, repository root)

```powershell
.\venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
# In a second terminal:
cd frontend
npm run dev -- --host 127.0.0.1
```

Open http://127.0.0.1:5173. Use an existing account, register, or use the development demo. `/auth/demo-login` returns 404 unless `ENVIRONMENT=development`. New demo accounts receive a random password, not a documented fixed credential. Existing databases may still contain legacy demo accounts; remove those accounts before production deployment and rotate the JWT signing secret to invalidate development tokens.

## Verification

- Production build and TypeScript compilation passed.
- Frontend: 6 tests passed, including dashboard empty states, date filtering, failure/retry, and real-data trace links.
- Backend: 9 tests passed, including the existing end-to-end API workflow and new development-demo restrictions.
- Frontend lint completed with React lifecycle/dependency warnings; it is not warning-free.
- Browser review covered desktop and mobile layouts, page-search filtering, Escape dismissal, navigation, and live database-backed empty states.

## Remaining scope and deployment limits

This redesign is not a certification of every requirement in the original master brief. Docker/PostgreSQL deployment, external paid providers, and production security hardening were not verified in this pass. Existing evaluation/retrieval algorithms and execution architecture are unchanged. TF-IDF and lexical overlap are local heuristics, not semantic embeddings or model-judged faithfulness. The missing-context faithfulness default requires further methodology work. Audit existing documentation against the implementation before making stronger product claims.

Before exposing the service publicly: configure a fresh signing secret, remove development/demo data, restrict CORS, add enforced request/upload limits and rate limiting, and verify durable background-job recovery. Existing shared development credentials must not be retained in production. End-to-end browser automation and expanded error-state coverage for secondary pages remain follow-up work.

Database migration verification also passed on a separate SQLite database using Alembic upgrade head. No PostgreSQL migration was exercised.
