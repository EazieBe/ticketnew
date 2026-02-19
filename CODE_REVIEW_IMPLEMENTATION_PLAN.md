# Code Review Implementation Plan

**Source**: Manus AI Code Review Report (Feb 16, 2026)  
**Generated**: Implementation plan for issues and PRs

---

## Workflow Modernization (Feb 2026)

### Phase A - Additive foundation (in progress)
- [x] Add `nro` to ticket type enums (backend model/schema + frontend ticket form/list filters)
- [x] Add `workflow_state` field to ticket model/schema (non-breaking; current status flow still works)
- [x] Add `ticket_version` field to ticket model/schema for optimistic concurrency
- [x] Add Alembic migration: `20260217_ticket_workflow_state_and_version.py`
- [x] Add optimistic-lock check to `PUT /tickets/{ticket_id}` (`expected_ticket_version` -> 409 conflict on stale write)
- [x] Auto-increment `ticket_version` on ticket mutations (claim, complete, check-in, check-out, approve, standard update)
- [x] Start mapping operational actions to workflow state (`claimed`, `onsite`, `offsite`, `pending_approval`, `ready_to_archive`)
- [x] Fix ticket create parity: persist `tech_rating`

### Phase B - Contract and transition enforcement (next)
- [x] Finalize canonical primary status set (`open`, `completed`, `archived`) and transition table by role
- [x] Introduce dedicated workflow transition endpoint(s) with role guards + precondition checks
- [x] Add dispatcher queues (`needstech`, `goback_required`, `pending_approval`, returns follow-up)
- [x] Add NRO 2-phase scheduling fields and transitions

### Phase C - Data quality and collision hardening (next)
- [x] Strict payload validation (`extra=forbid` on critical write schemas)
- [x] Input normalization/cleansing rules (INC/SO/category/notes boundaries)
- [x] Add mismatch/error messaging on stale ticket writes in frontend
- [x] Add tests for concurrent update conflict handling

### Phase D - Reporting + OpenAPI parity (next)
- [x] Update reports to include workflow states, aging queues, NRO phase metrics, and return tracking
- [x] Update API docs/tags/examples for workflow endpoints and conflict responses
- [x] Add migration + schema parity checks in CI path

---

## Phase 1: Critical Security Fixes

### Issue #1: Remove SECRET_KEY Default Fallback
**Priority**: P0 – Critical  
**File**: `backend/utils/auth.py`  
**Current**: `SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")`  
**Action**: Remove default; raise immediately if unset  
**PR**: `fix/auth-require-explicit-secret-key`

```python
# Change to: fail fast if not set
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY or len(SECRET_KEY) < 32:
    raise ValueError("SECRET_KEY must be set (32+ chars). Set in .env or environment.")
```

**Acceptance**: App refuses to start without valid `SECRET_KEY` in environment.

---

### Issue #2: Distributed Rate Limiting
**Priority**: P0 – Critical (for multi-instance deployments)  
**Files**: `backend/utils/auth.py`, new `backend/utils/rate_limit.py`  
**Current**: In-memory `_RATE_BUCKETS` dict (per-process, not distributed)  
**Action**: Implement Redis-based rate limiting using existing Redis connection  
**PR**: `feat/distributed-rate-limiting`

**Tasks**:
- Create `rate_limit.py` with Redis-backed `check_rate_limit(ip, endpoint, limit, window)`
- Replace in-memory buckets in `auth.py` login path
- Add config: `RATE_LIMIT_PER_MINUTE` (e.g., 10) in settings/env
- Document in `env.template`

**Acceptance**: Rate limits are enforced across multiple backend instances.

---

### Issue #3: HTTP-Only Cookies for Refresh Tokens
**Priority**: P1 – High  
**Files**: `backend/main.py` (or auth router), `frontend/src/axiosConfig.js`, `frontend/src/AuthContext.js`  
**Current**: Both access and refresh tokens in `sessionStorage`  
**Action**: Move refresh token to HTTP-only cookie; keep access token in memory/sessionStorage  
**PR**: `feat/http-only-refresh-token`

**Tasks**:
- Backend: Set refresh token in cookie (`Set-Cookie`) with `HttpOnly; Secure; SameSite=Strict`
- Backend: Read refresh token from cookie (not body) in `/refresh` endpoint
- Frontend: Remove refresh token from sessionStorage; update AuthContext to rely on cookie
- Add CSRF token or SameSite protection per review recommendation

**Acceptance**: Refresh token not readable by JS; access token still works for API calls.

---

## Phase 2: Security Hardening

### Issue #4: Consistent Input Sanitization Audit
**Priority**: P1  
**Files**: `frontend/src/utils/security.js`, all components rendering user content  
**Action**: Audit and apply `sanitizeHtml` / `sanitizeInput` wherever user data is rendered  
**PR**: `security/consistent-sanitization-audit`

**Tasks**:
- List all places user content is rendered (comments, notes, descriptions, etc.)
- Ensure sanitization before rendering; fix any missing calls
- Add unit tests for sanitization in critical paths
- Document when to use each function in `security.js`

---

### Issue #5: Improve env.template
**Priority**: P1  
**File**: `env.template`  
**Action**: Add clearer comments, examples, and generation commands  
**PR**: `docs/improve-env-template`

**Tasks**:
- Add comment block at top: purpose of each section
- `SECRET_KEY`: emphasize “never commit; generate with secrets.token_urlsafe(32)”
- `DATABASE_URL`: example for local vs Docker
- `REDIS_URL`: when optional vs required
- `CORS_ORIGINS`: explain comma-separated list, LAN use case
- Add `RATE_LIMIT_PER_MINUTE` (if implemented in #2)

---

## Phase 3: Backend Robustness

### Issue #6: Remove Default SECRET_KEY from env.template
**Priority**: P1  
**File**: `env.template`  
**Action**: Replace placeholder with non-functional example (e.g., “REPLACE_WITH_GENERATED_KEY”)  
**PR**: Can be combined with #5

---

### Issue #7: Explicit String Lengths in Models
**Priority**: P2  
**File**: `backend/models.py`  
**Action**: Add explicit lengths to `Column(String)` where sensible (e.g., 255 for names, 64 for IDs)  
**PR**: `refactor/model-string-lengths`

**Tasks**:
- Review each `Column(String)`; add `String(255)` or similar
- Add migration if needed for DB compatibility (PostgreSQL typically allows this)
- Document conventions in a short models doc or comment

---

### Issue #8: Cascading Deletes via ORM
**Priority**: P2  
**Files**: `backend/models.py`, `backend/crud.py`  
**Action**: Use SQLAlchemy `cascade` on relationships; simplify `delete_site` and similar  
**PR**: `refactor/orm-cascading-deletes`

**Tasks**:
- Add `cascade='all, delete-orphan'` (or appropriate) on Equipment, Shipment, InventoryTransaction w.r.t. Site
- Simplify `delete_site` to rely on cascades; remove manual delete loops where safe
- Add migration if any schema change; test delete flows

---

### Issue #9: JSONB for User.preferences
**Priority**: P3  
**Files**: `backend/models.py`, `backend/schemas.py`, migrations  
**Action**: Change `User.preferences` from `Text` to `JSONB` if it stores JSON  
**PR**: `feat/user-preferences-jsonb`

**Tasks**:
- Confirm `preferences` stores JSON
- Add migration: `ALTER COLUMN preferences TYPE jsonb USING preferences::jsonb`
- Update schemas and any code that reads/writes `preferences`

---

### Issue #10: Consistent API Error Handling
**Priority**: P2  
**Files**: `backend/routers/*.py`  
**Action**: Standardize error responses (status codes, message format, no sensitive details)  
**PR**: `refactor/consistent-error-handling`

**Tasks**:
- Define standard error response shape (e.g., `{detail, code, request_id}`)
- Add exception handler for common cases (DB errors, validation, auth)
- Audit routers for uncaught exceptions; add try/except where needed
- Document expected errors in API docs

---

## Phase 4: Frontend and UX

### Issue #11: Code Splitting / Lazy Loading
**Priority**: P2  
**Files**: `frontend/src/App.js`, route definitions  
**Action**: Use `React.lazy` and `Suspense` for route-level splitting  
**PR**: `perf/frontend-code-splitting`

**Tasks**:
- Identify heaviest route components (e.g., Tickets, Reports, Map)
- Wrap with `React.lazy`; add `Suspense` fallback
- Measure initial bundle size before/after
- Ensure no regressions in navigation

---

### Issue #12: Error Boundary Coverage
**Priority**: P2  
**Files**: `frontend/src/ErrorBoundary.js`, `App.js`  
**Action**: Ensure ErrorBoundary wraps critical sections and provides clear fallback  
**PR**: `feat/error-boundary-coverage`

**Tasks**:
- Audit where ErrorBoundary is used
- Wrap main layout and high-risk routes
- Add “Retry” and “Report” actions in fallback UI

---

### Issue #13: Frontend Sanitization Usage
**Priority**: P1 (overlaps with #4)  
**File**: `frontend/src/utils/security.js`  
**Action**: Document when to use `sanitizeHtml` vs `sanitizeInput`; add usage examples  
**PR**: Can be part of #4

---

## Phase 5: Testing and Documentation

### Issue #14: API Documentation
**Priority**: P2  
**Files**: `backend/main.py`  
**Action**: Expose and document OpenAPI/Swagger; add examples for key endpoints  
**PR**: `docs/openapi-enhancements`

**Tasks**:
- Confirm `/docs` and `/redoc` are enabled
- Add `summary`, `description`, and `example` where useful
- Document auth flow and error responses

---

### Issue #15: Frontend Unit/Integration Tests
**Priority**: P2  
**Files**: New `frontend/src/**/*.test.js`  
**Action**: Add Jest + React Testing Library tests for critical components  
**PR**: `test/frontend-unit-tests`

**Tasks**:
- Add Jest/RTL if not present
- Test login, ticket list, form validation, error states
- Aim for >50% coverage on main flows

---

### Issue #16: E2E Tests
**Priority**: P3  
**Files**: New `e2e/` directory  
**Action**: Add Playwright or Cypress for critical flows  
**PR**: `test/e2e-critical-flows`

**Tasks**:
- Login → create ticket → view ticket
- Create shipment; update status
- Run in CI (optional)

---

## Phase 6: Performance and Scalability

### Issue #17: Database Query Review
**Priority**: P2  
**Files**: `backend/crud.py`, `backend/routers/*.py`  
**Action**: Enable `echo=True` temporarily; run EXPLAIN ANALYZE on hot paths  
**PR**: `perf/query-optimization`

**Tasks**:
- Focus on `/tickets`, `/search`, list endpoints
- Add/remove indexes based on query patterns
- Consider `selectinload` / `joinedload` for N+1 prevention

---

### Issue #18: Connection Pool Tuning
**Priority**: P3  
**Files**: `backend/database.py`, `backend/settings.py`  
**Action**: Make `pool_size` and `max_overflow` configurable via env  
**PR**: `config/db-pool-tuning`

---

### Issue #19: Task Queue for Heavy Operations
**Priority**: P3  
**Files**: New `backend/tasks/` (e.g., Celery)  
**Action**: Offload reports, bulk email, large exports to Celery + Redis  
**PR**: `feat/celery-background-tasks`

---

## Summary

| Phase | Issues | Est. Effort |
|-------|--------|-------------|
| 1 – Critical Security | 3 | 2–3 days |
| 2 – Security Hardening | 3 | 1–2 days |
| 3 – Backend Robustness | 5 | 2–3 days |
| 4 – Frontend | 3 | 1–2 days |
| 5 – Testing/Docs | 3 | 2–3 days |
| 6 – Performance | 3 | 2–4 days |

**Suggested order**: #1 → #5/#6 → #2 → #4 → #3 → #5 (remaining) → #6

---

## GitHub Issue Labels

Suggested labels for tracking:

- `security` – Issues #1–6, #13  
- `refactor` – #7, #8, #10  
- `performance` – #11, #17, #18, #19  
- `testing` – #15, #16  
- `documentation` – #5, #14  
- `enhancement` – #9, #12  
