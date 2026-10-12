# Requirements

Source of truth: `Full Stack Developer (React Native Predominant) Assignment.md` (Downloads).
Status values: NOT STARTED | IN PROGRESS | BLOCKED | VERIFIED (evidence required, see `verification.md`).

| ID | Requirement | Acceptance criterion | Pri | Status |
|---|---|---|---|---|
| AUTH-001 | Register with email + password | `POST /auth/register` creates a user, stores only a password hash, rejects malformed email, weak password, duplicate email | P0 | VERIFIED (API tests; emulator E2E; Sprint 1 B3) |
| AUTH-002 | Login with registered credentials | `POST /auth/login` returns tokens for valid credentials; identical error for unknown email and wrong password | P0 | VERIFIED (API tests; emulator E2E incl. wrong password) |
| AUTH-003 | Session expiry handling | Expired/invalid access token yields 401; app refreshes or returns to login | P1 | VERIFIED (Sprint 2 B5; plus Sprint 3 durability window B7) |
| TASK-001 | Create task | Task persisted with title, description, date-time, deadline, priority; empty title rejected | P0 | VERIFIED (emulator E2E with server read-back) |
| TASK-002 | List/retrieve tasks with status | Authenticated user receives only own tasks, each with completion status | P0 | VERIFIED (emulator E2E) |
| TASK-003 | Complete a task | Server persists completed flag + completedAt; visible after fresh fetch | P0 | VERIFIED (server completed state after UI toggle) |
| TASK-004 | Delete a task | Task absent on subsequent fetch; unknown id yields 404 | P0 | VERIFIED (server count 0 after UI delete) |
| TASK-005 | Date-time, deadline, priority | Priority is one of low/medium/high; deadline must be >= date-time; invalid dates rejected | P1 | VERIFIED (persisted fields on device; deadline rule in Jest and API tests, not triggered on device) |
| TASK-006 | Update a task | Owner can edit fields; non-owner gets 404 | P1 | VERIFIED (Jest; device edit read back from server; cross-user edit rejected) |
| API-001 | Authenticated task API | All `/tasks` routes reject missing/invalid tokens | P0 | VERIFIED (security.test.ts: every protected route, forged/unsigned/wrong-key tokens) |
| DATA-001 | Persistence + user isolation | Ownership enforced in the server query; user A cannot read/update/complete/delete user B's task | P0 | VERIFIED (cross-user tests incl. tag changes and account deletion isolation) |
| SORT-001 | Combined time/deadline/priority sort (bonus) | Documented scoring; ties broken deterministically; unit tested | P1 | VERIFIED (table tests; API; device order) |
| CAT-001 | Categories/tags (bonus) | Tags stored per task and filterable | P2 | VERIFIED (API persistence; device create and filter) |
| FILT-001 | Filtering (bonus) | Filter by status, priority, tag | P2 | VERIFIED (table tests; device filters) |
| UI-001 | Material 3 Expressive UI | Tokens, shapes, motion, states per `design-system.md` | P1 | PARTIALLY VERIFIED (Material 3 style tokens, shapes, components, dark theme on device; wavy progress and confetti deliberately not built; no official component conformance check) |
| UI-002 | Empty/loading/error states | Each list/form screen shows all three | P1 | VERIFIED for task list, forms and dialogs (full-screen error state in Jest only) |
| A11Y-001 | Accessibility | 48dp targets, labels, font scaling to 200% without clipping | P2 | PARTIALLY VERIFIED (contrast tests, 48dp audit, labels, 200% font, 360dp screen, reduced-motion hook in Jest; TalkBack speech/swipe order and a physical device NOT verified; see A11Y-002/003) |
| SEC-001 | Security baseline | Argon2/bcrypt, rate limiting, no secrets in git, helmet, input validation | P0 | PARTIALLY VERIFIED (argon2id, hashed refresh tokens, rate limiter, CORS, proxy handling, HTTPS enforcement header logic, injection and leak tests all pass locally; real TLS, hosted CORS and production monitoring NOT exercised) |
| FAIL-001 | Failure handling | Offline, 5xx, double-submit handled with visible state | P1 | VERIFIED (Sprint 2 B5) |
| SEC-002 | Refresh-token durability | A response lost after rotation must not strand the session; replay protection unchanged | P1 | PARTIALLY VERIFIED (API and client tests with mutation checks; residual: app reopened after the grace window; interrupted rotation not reproduced on device) |
| SEC-003 | Backend lifecycle and hardening | Fail-fast sanitized startup, readiness, graceful close, request log without secrets, per-user API limiter, proxy-aware limits | P1 | VERIFIED locally (lifecycle and security tests, compiled-server smoke run); hosted behaviour NOT verified |
| PRIV-001 | Account deletion | Password-confirmed in-app deletion removes user, tasks and sessions | P0 (Play) | VERIFIED (4 backend tests with mutation checks, 5 Jest tests, device run with server read-back); web deletion URL for Play Console NOT provided |
| REL-003 | Production API URL gate | Release builds are refused unless `PRODUCTION_API_URL` is a public https origin; app explains an unconfigured build | P0 | VERIFIED (11 gate tests, Gradle gate exercised both ways, ConfigGate tests, minified app showed the safe error path) |
| REL-004 | Signed release artifact | Release signed with an upload key kept outside the repo | P0 | BLOCKED (no key exists on this machine; creation needs your approval) |
| DEP-001 | Hosted backend | API reachable over https with hosted MongoDB, backups, logging | P0 | BLOCKED (nothing deployed; deployment.md lists your decisions) |
| A11Y-002 | TalkBack screen-reader run | Speech and swipe order checked with TalkBack | P2 | NOT VERIFIED (service ran and focus ring observed; speech cannot be captured through adb; manual procedure in verification.md B9) |
| A11Y-003 | Keyboard traversal | Logical focus order with hardware keyboard and IME Next | P2 | PARTIALLY VERIFIED (IME Next fixed and verified; hardware Tab order on the login form still non-sequential) |
| REL-001 | Android release build | Signed release APK/AAB builds; key kept outside repo | P3 | PARTIALLY VERIFIED (unsigned release APK builds, minified, bundle packaged, manifest and permissions inspected, minified smoke run on emulator; signed artifact and AAB NOT produced) |
| REL-002 | Play readiness | Documented; items needing Play Console marked human-action | P3 | BLOCKED (see deployment.md: hosting, production URL, signing key, privacy policy URL, Play Console forms and data-safety declaration need your decisions) |

## Conflicts
- The reference APK is native Kotlin/Compose, local-only (Room), with no auth/backend. The assignment mandates React Native CLI + backend + auth; the assignment wins.

## Backlog (not forgotten, out of Sprint 1 scope)
- Search, calendar view, bulk select, per-category management (rename/delete).
- Wavy progress indicator and confetti (needs SVG/Skia dependency; restrained alternative shipped).
- Voice task, repeat/reminders/notifications, backup/export, self-update (reference-only features).
- Release signing, https production API URL (`PRODUCTION_API_URL` is intentionally empty), AAB, Play listing.
