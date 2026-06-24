**Code Review Report**

- **Overall:** Solid FastAPI + React/Vite project with broad backend tests and clear Russian user docs.
- **Validation Run:** `frontend npm run build` and `npm test` pass; `backend pytest -q` — **72 passed**.

## Addressed (2026-06)

### High priority

- **Indicative-date behavior:** New sub-stages with dates default to `is_indicative=True` on create (`sub_stages.py`); only planned stages drive task indicative min/max (`stage_indicative.py`). Tests updated in `test_sub_stages.py`.
- **Notification thread / SQLite:** Tests disable delivery via `NOTIFICATIONS_ENABLED=false` in `conftest.py`; injectable `set_delivery_fn()` for unit tests; custom delivery runs synchronously without opening a new DB session.
- **Open CORS + spoofable user:** `CORS_ORIGINS` and `REQUIRE_USER_NAME` in `config.py`; restricted CORS and write-guard middleware in `main.py`; `test_security.py`.

### Medium priority

- **Raw import errors:** `projects.py` logs exceptions and returns a generic Russian message.
- **Frontend test tooling:** ESLint, Prettier, Vitest; unit tests for `useNow`, `stageComplete`, `pendingChangesStore`.
- **TaskDrawer size:** Split into `frontend/src/components/taskDrawer/` (hook, context, tab components); shell in `TaskDrawer.tsx`.

### Docs / CI

- `.env.example` — `CORS_ORIGINS`, `REQUIRE_USER_NAME`
- README — security notes, frontend test/lint commands
- `scripts/ci.sh` — backend + frontend lint/test/build

## Remaining ideas (optional)

- Full authentication (OAuth/SSO) instead of `X-User-Name` header trust.
- More frontend component tests (Gantt, pending changes UI).
- GitHub Actions workflow wrapping `scripts/ci.sh`.
