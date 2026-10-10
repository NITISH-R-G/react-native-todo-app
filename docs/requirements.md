# Requirements

Source of truth: `Full Stack Developer (React Native Predominant) Assignment.md` (Downloads).
Status values: NOT STARTED | IN PROGRESS | BLOCKED | VERIFIED (evidence required, see `verification.md`).

| ID | Requirement | Acceptance criterion | Pri | Status |
|---|---|---|---|---|
| AUTH-001 | Register with email + password | `POST /auth/register` creates a user, stores only a password hash, rejects malformed email, weak password, duplicate email | P0 | VERIFIED (API tests + emulator E2E, B3) |
| AUTH-002 | Login with registered credentials | `POST /auth/login` returns tokens for valid credentials; identical error for unknown email and wrong password | P0 | VERIFIED (API tests + emulator E2E incl. wrong password, B3) |
| AUTH-003 | Session expiry handling | Expired/invalid access token yields 401; app refreshes or returns to login | P1 | VERIFIED (backend: multi-session, atomic rotation race test, logout; app: Jest; device: silent refresh after expiry, restart with expired token, rejected refresh -> notice banner, offline launch keeps session - verification.md B5) |
| TASK-001 | Create task | Task persisted with title, description, date-time, deadline, priority; empty title rejected | P0 | VERIFIED (emulator E2E + server read-back, B3) |
| TASK-002 | List/retrieve tasks with status | Authenticated user receives only own tasks, each with completion status | P0 | VERIFIED (emulator E2E, B3) |
| TASK-003 | Complete a task | Server persists completed flag + completedAt; visible after fresh fetch | P0 | VERIFIED (server completed+completedAt after UI toggle, B3) |
| TASK-004 | Delete a task | Task absent on subsequent fetch; unknown id yields 404 | P0 | VERIFIED (server count 0 after UI delete, B3) |
| TASK-005 | Date-time, deadline, priority | Priority is one of low/medium/high; deadline must be >= date-time; invalid dates rejected | P1 | VERIFIED (fields persisted via device; deadline<start rule verified in Jest + API tests, not on device) |
| TASK-006 | Update a task | Owner can edit fields; non-owner gets 404 | P1 | VERIFIED (Jest edit suite; device edit of title/priority/category read back from server; cross-user edit rejected by backend test) |
| API-001 | Authenticated task API | All `/tasks` routes reject missing/invalid tokens | P0 | VERIFIED (backend tests + curl 401 without/with bad token, B1/B3) |
| DATA-001 | Persistence + user isolation | Ownership enforced in the server query; user A cannot read/update/complete/delete user B's task | P0 | VERIFIED (backend; see B1) |
| SORT-001 | Combined time/deadline/priority sort (bonus) | Documented scoring; ties broken deterministically; unit tested | P1 | VERIFIED (14-case table test + total-order check; API integration; device order for smart/deadline/newest matched prediction) |
| CAT-001 | Categories/tags (bonus) | Tags stored per task and filterable | P2 | VERIFIED (tags persisted via API tests; device: new category created, stored, appears as filter) |
| FILT-001 | Filtering (bonus) | Filter by status, priority, tag | P2 | VERIFIED (table test; Jest list tests; device: overdue, category, composed filters, empty-match state) |
| UI-001 | Material 3 Expressive UI | Tokens, shapes, motion, states per `design-system.md` | P1 | IN PROGRESS (tokens, shapes, segmented control, pill nav, priority accent, snackbar, dark theme done; wavy progress and confetti deliberately not implemented - decisions.md D15) |
| UI-002 | Empty/loading/error states | Each list/form screen shows all three | P1 | VERIFIED for task list + form (empty, loading, offline banner, inline errors on device; full-screen error state in Jest only) |
| A11Y-001 | Accessibility | 48dp targets, labels, font scaling to 200% without clipping | P2 | IN PROGRESS (contrast tests, 48dp audit, label audit, 200% font + 360dp screens captured; TalkBack and keyboard-only traversal NOT run) |
| SEC-001 | Security baseline | Argon2/bcrypt, rate limiting, no secrets in git, helmet, input validation | P0 | IN PROGRESS (argon2id, Keychain, multi-session atomic rotation + logout verified; rate limiter and CORS untested) |
| FAIL-001 | Failure handling | Offline, 5xx, double-submit handled with visible state | P1 | VERIFIED (device offline: banner, create error, single create on recovery; Jest: 5xx/HTML/malformed, no auto-retry of mutations, double-submit guards with mutation checks; 5xx not exercised on device) |
| REL-001 | Android release build | Signed release APK/AAB builds; key kept outside repo | P3 | NOT STARTED |
| REL-002 | Play readiness | Documented; items needing Play Console marked human-action | P3 | NOT STARTED |

## Conflicts
- The reference APK is native Kotlin/Compose, local-only (Room), with no auth/backend. The assignment mandates React Native CLI + backend + auth; the assignment wins.

## Backlog (not forgotten, out of Sprint 1 scope)
- Search, calendar view, bulk select, per-category management (rename/delete).
- Wavy progress indicator and confetti (needs SVG/Skia dependency; restrained alternative shipped).
- Voice task, repeat/reminders/notifications, backup/export, self-update (reference-only features).
- Release signing, https production API URL (`PRODUCTION_API_URL` is intentionally empty), AAB, Play listing.
