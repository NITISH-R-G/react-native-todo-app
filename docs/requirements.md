# Requirements

Source of truth: `Full Stack Developer (React Native Predominant) Assignment.md` (Downloads).
Status values: NOT STARTED | IN PROGRESS | BLOCKED | VERIFIED (evidence required, see `verification.md`).

| ID | Requirement | Acceptance criterion | Pri | Status |
|---|---|---|---|---|
| AUTH-001 | Register with email + password | `POST /auth/register` creates a user, stores only a password hash, rejects malformed email, weak password, duplicate email | P0 | IN PROGRESS (API done, app UI pending) |
| AUTH-002 | Login with registered credentials | `POST /auth/login` returns tokens for valid credentials; identical error for unknown email and wrong password | P0 | IN PROGRESS (API done, app UI pending) |
| AUTH-003 | Session expiry handling | Expired/invalid access token yields 401; app refreshes or returns to login | P1 | IN PROGRESS (API done, app UI pending) |
| TASK-001 | Create task | Task persisted with title, description, date-time, deadline, priority; empty title rejected | P0 | IN PROGRESS (API done, app UI pending) |
| TASK-002 | List/retrieve tasks with status | Authenticated user receives only own tasks, each with completion status | P0 | IN PROGRESS (API done, app UI pending) |
| TASK-003 | Complete a task | Server persists completed flag + completedAt; visible after fresh fetch | P0 | IN PROGRESS (API done, app UI pending) |
| TASK-004 | Delete a task | Task absent on subsequent fetch; unknown id yields 404 | P0 | IN PROGRESS (API done, app UI pending) |
| TASK-005 | Date-time, deadline, priority | Priority is one of low/medium/high; deadline must be >= date-time; invalid dates rejected | P1 | IN PROGRESS (API done, app UI pending) |
| TASK-006 | Update a task | Owner can edit fields; non-owner gets 404 | P1 | IN PROGRESS (API done, app UI pending) |
| API-001 | Authenticated task API | All `/tasks` routes reject missing/invalid tokens | P0 | VERIFIED (backend; see verification.md §B1) |
| DATA-001 | Persistence + user isolation | Ownership enforced in the server query; user A cannot read/update/complete/delete user B's task | P0 | VERIFIED (backend; see verification.md §B1) |
| SORT-001 | Combined time/deadline/priority sort (bonus) | Documented scoring; ties broken deterministically; unit tested | P1 | IN PROGRESS (API done, app UI pending) |
| CAT-001 | Categories/tags (bonus) | Tags stored per task and filterable | P2 | NOT STARTED |
| FILT-001 | Filtering (bonus) | Filter by status, priority, tag | P2 | IN PROGRESS (API done, app UI pending) |
| UI-001 | Material 3 Expressive UI | Tokens, shapes, motion, states per `design-system.md` | P1 | NOT STARTED |
| UI-002 | Empty/loading/error states | Each list/form screen shows all three | P1 | NOT STARTED |
| A11Y-001 | Accessibility | 48dp targets, labels, font scaling to 200% without clipping | P2 | NOT STARTED |
| SEC-001 | Security baseline | Argon2/bcrypt, rate limiting, no secrets in git, helmet, input validation | P0 | IN PROGRESS (API done, app UI pending) |
| FAIL-001 | Failure handling | Offline, 5xx, double-submit handled with visible state | P1 | NOT STARTED |
| REL-001 | Android release build | Signed release APK/AAB builds; key kept outside repo | P3 | NOT STARTED |
| REL-002 | Play readiness | Documented; items needing Play Console marked human-action | P3 | NOT STARTED |

## Conflicts
- The reference APK is native Kotlin/Compose, local-only (Room), with no auth/backend. The assignment mandates React Native CLI + backend + auth; the assignment wins.
