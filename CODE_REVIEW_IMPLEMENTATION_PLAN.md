# Code Review Implementation Plan

**Source**: Manus AI Code Review Report (Feb 16, 2026)
**Last Updated**: 2026-02-02

---

## Workflow Modernization (Feb 2026)

### Phase A - Additive foundation (completed)
- [x] Add `nro` to ticket type enums (backend model/schema + frontend ticket form/list filters)
- [x] Add `workflow_state` field to ticket model/schema (non-breaking; current status flow still works)
- [x] Add `ticket_version` field to ticket model/schema for optimistic concurrency
- [x] Add Alembic migration: `20260217_ticket_workflow_state_and_version.py`
- [x] Add optimistic-lock check to `PUT /tickets/{ticket_id}` (`expected_ticket_version` -> 409 conflict on stale write)
- [x] Auto-increment `ticket_version` on ticket mutations (claim, complete, check-in, check-out, approve, standard update)
- [x] Start mapping operational actions to workflow state (`claimed`, `onsite`, `offsite`, `pending_approval`, `ready_to_archive`)
- [x] Fix ticket create parity: persist `tech_rating`

### Phase B - Contract and transition enforcement (completed)
- [x] Finalize canonical primary status set (`open`, `completed`, `archived`) and transition table by role
- [x] Introduce dedicated workflow transition endpoint(s) with role guards + precondition checks
- [x] Add dispatcher queues (`needstech`, `goback_required`, `pending_approval`, returns follow-up)
- [x] Add NRO 2-phase scheduling fields and transitions

### Phase C - Data quality and collision hardening (completed)
- [x] Strict payload validation (`extra=forbid` on critical write schemas)
- [x] Input normalization/cleansing rules (INC/SO/category/notes boundaries)
- [x] Add mismatch/error messaging on stale ticket writes in frontend
- [x] Add tests for concurrent update conflict handling

### Phase D - Reporting + OpenAPI parity (completed)
- [x] Update reports to include workflow states, aging queues, NRO phase metrics, and return tracking
- [x] Update API docs/tags/examples for workflow endpoints and conflict responses
- [x] Add migration + schema parity checks in CI path

---

## Code Review Backlog (active)

Only remaining work is kept here; completed items were removed to keep this plan operational.

### Security and auth
- [ ] Move refresh tokens to secure HTTP-only cookies and remove browser-managed refresh token storage.
- [ ] Complete frontend sanitization audit and add targeted tests/docs for `sanitizeHtml` vs `sanitizeInput`.

### Backend robustness
- [ ] Standardize API error envelopes (shape, codes, and handler coverage).
- [ ] Decide and implement `User.preferences` storage strategy (`Text` vs `JSONB`) with migration if needed.
- [ ] Evaluate and apply ORM cascade cleanup where safe (then simplify manual delete paths).

### Testing and quality
- [ ] Expand frontend test coverage beyond spot checks (critical auth/ticket/shipment flows).
- [ ] Add E2E smoke coverage for login, ticket creation, and shipment lifecycle.

### Performance and operations
- [ ] Run query profiling on hot paths and tune indexes/select loading.
- [ ] Validate DB pool tuning under load and finalize env defaults.
- [ ] Decide on async task queue scope (reporting/exports) and implement only if needed.

---

## Workflow & scope agreed (Feb 2026)

Reference for what we discussed and implemented. Use for lookback and to mark off as verified in production.

### Inhouse
- [x] Dispatcher creates (site, optional INC#/SO#). Staff claim, add notes.
- [x] Outcomes: **completed** (needs admin/dispatcher approval before archiving), **followup** (stays assigned, follow-up date, reminders), **needstech** (same ticket converted to onsite).
- [x] Shipments can be added from ticket; expected vs received returns tracked (`follow_up_required`, `parts_received`, return-received endpoint).
- [x] Archived tickets only under associated site: list filter for archived; site-scoped archived view on site detail is optional.

### Onsite
- [x] Dispatcher creates with site, optional INC#/SO#, **scheduled date**; daily view for that day’s onsite tickets.
- [x] **Go back** → ticket marked goback, to dispatcher for reschedule; history preserved.
- [x] **Tech arrived** / **Tech offsite** with check-in and check-out times.
- [x] Track internal time vs field tech time (`time_spent`, `onsite_duration_minutes`, time-entries tab).
- [x] Materials/billing: `equipment_affected`, `parts_needed`, `billing_rate`, `total_cost` (line-item list for billing is optional).
- [x] If shipment needs field tech return: ticket stays open, to dispatcher for scheduling.
- [x] Completed → approval before archive.

### NRO
- [x] Two phases (e.g. Starlink then equipment); ticket completed only when both phases done.
- [x] Separate scheduling and go-back per phase; phase controls on ticket detail.

### Cross-cutting
- [x] **Status** = `open` | `completed` | `archived`; **workflow_state** for operational detail (scheduled, onsite, needstech, goback, NRO phases, etc.).
- [x] Dispatcher (and admin) queues: completed needing approval, needstech, goback, expected returns; queue actions via modal.
- [x] Field tech assignment tracked (`onsite_tech_id`).
- [x] Optimistic locking (`ticket_version` / `expected_ticket_version`); audit timeline; reporting (workflow, queues, NRO, returns, time).
- [x] Compact forms aligned with backend; payload validation and strip of read-only fields.

### Time tracking (onsite timer vs Time Entries)
- **Onsite timer**: When a tech checks in, the ticket shows a live timer; when they check out, the backend stores `check_in_time` / `check_out_time` and can create a **time entry** for that segment. So “tech onsite” duration is automatic.
- **Time Entries tab**: Lists all time segments for the ticket — both auto-created from check-in/out and **manual** entries (e.g. “James 20 mins” internal work added via the time tracker or API). Same data store; the tab is “who worked and how long” in one place. No separate “form section” for time entries on the create form — time entries are added on the **ticket detail** page (Time Entries tab / TimeTracker).

### Materials / billing
- **No line items for materials** (agreed): Form stays with `equipment_affected`, `parts_needed`, `billing_rate`, `total_cost`. No structured line-item list to reduce clutter.

---

## UI Polish Package (Feb 2026)

- [ ] **Theme** – Apply ticketnew-style palette and component overrides (MuiButton, MuiCard, MuiChip, MuiStepper, MuiTableCell) in `createAppTheme`.
- [ ] **Sidebar** – Collapsible sidebar with prominent “New Ticket” button, role-aware nav (admin/dispatcher section), same routes as current drawer.
- [ ] **Ticket creation stepper** – Multi-step “Create New Ticket” flow (Basic → Type details → Scheduling & assignment → Notes & review) to reduce clutter and guide users; same backend API and payload as current form.
- [ ] **Wireframes** – Optional: align final UI with provided wireframe sketches.

---

## Worth checking / optional additions

- [ ] **Time breakdown** – Explicit per-person lines (“James 20 mins”, “Field tech X 2h onsite”) in UI/reports if not already satisfied by time_entries + check-in/out.
- [x] **Materials line items** – Not adding; keeping form with parts_needed + total cost to avoid clutter.
- [ ] **Follow-up reminders** – Daily list or notification for tickets with follow-up date due (e.g. report filter “follow-up due today” or notification).
- [ ] **Health / backend unreachable** – Frontend banner when backend is unreachable or stale.
- [ ] **Site-scoped archived** – On site detail page, show archived tickets for that site only (if not already there).

---

## Technical debt & risks

- [ ] **`Base.metadata.create_all()` in startup** – Dangerous in production. Remove or guard so schema changes come only from Alembic; ensure startup does not create/drop tables.
- [ ] **Alembic migrations** – Ensure migrations are run in deployment/CI and documented (e.g. in README or runbook). Migrations exist in `backend/alembic/versions/`; make sure they are applied in every environment.
- [ ] **Frontend: plain JS + old CRA + many Contexts** – Scaling risk (bundle size, context re-renders). Plan: consider TypeScript, CRA → Vite or similar, and consolidating or splitting Contexts as the app grows.
- [ ] **WebSocket client mismatch** – Frontend uses `socket.io-client`; backend may use native FastAPI WebSockets. Align client and server (either both Socket.IO or both native WS) and document the contract.
- [ ] **Tests visibility** – Backend has pytest (e.g. `backend/tests/`); frontend has some Jest. Ensure tests are documented, run in CI, and visible (e.g. README “How to run tests”). Add or surface tests so reviewers and new devs see them.

---

## Other follow-ups

- [ ] Document “how to run the app” (dev vs prod) and “how to run tests” in README or CONTRIBUTING.
- [ ] Consider explicit string lengths on `Column(String)` in models (e.g. 255 for names) and a migration if needed.
- [ ] Optional: runtime mode indicator (dev/prod) in UI – implemented; verify it’s visible in production build.
