# Acceptance report (Sprint 4)

Sprint 4 source commit under test: `6df1057`; docs and test config were committed in `e612582` with no runtime change. Sprint 5 results are folded into the rows below. Dates are 2026-10-17. Status vocabulary: VERIFIED, PARTIALLY VERIFIED, NOT VERIFIED, BLOCKED.

Evidence kinds: **Auto** = automated test, **Emu** = emulator run on this machine (Android 35 x86_64 AVD `ref35`, headless), **API** = curl against the running local backend, **None** = not done. No physical device was used.

## Requirement matrix

| Requirement | Implementation | Evidence | Status |
|---|---|---|---|
| Registration | `backend/src/routes/auth.ts` (register), `backend/src/validation.ts`, `app/src/screens/AuthScreens.tsx`, `app/src/ui/AuthForm.tsx` | Auto (backend api.e2e, security; app auth tests). Emu: registered `s4.alice` in the UI and landed on the task list (`docs/evidence/app-sprint4/02` to `04`). API: weak password gives 400 | VERIFIED |
| Login | `routes/auth.ts` (login), `app/src/state/authStore.ts` | Auto. Emu: login screen shown after logout in earlier sprints, session restored after force-stop this sprint. API: wrong password gives 401 | VERIFIED |
| Task creation with title, description, date-time, deadline, priority | `backend/src/routes/tasks.ts`, `models/Task.ts`, `app/src/screens/TaskFormScreen.tsx`, `ui/DateTimeRow.tsx` | Emu: created "Submit assignment" with description, High priority, start date-time and deadline; server read-back shows all fields (`server-readback-after-create.json`) | VERIFIED |
| Completion and status display | `tasks.ts` (completed, completedAt), `ui/TaskCard.tsx`, `ui/ProgressHeader.tsx` | Emu: checkbox tap, progress 100 percent, server `completed:true` with `completedAt` (`server-readback-after-complete.txt`) | VERIFIED |
| Editing | `tasks.ts` (PATCH), `TaskFormScreen.tsx` (edit mode) | Emu: changed title and priority to Low, server read-back confirms and completion state kept (`server-readback-after-edit.txt`) | VERIFIED |
| Deletion | `tasks.ts` (DELETE), `ui/TaskCard.tsx` menu, confirm dialog | Emu: menu, Delete, confirm; server list no longer contains the task (`server-readback-after-delete.txt`) | VERIFIED |
| Smart sorting, sort options | `backend/src/domain/sort.ts`, `backend/src/routes/tasks.ts` (`sort=smart|deadline|created`), header sort menu | Auto (table tests plus a new `sort=created` regression test with a mutation check). Emu (Sprint 5, three UI-created tasks): Smart, Nearest deadline and Newest first each matched the backend order exactly (`evidence/app-sprint5/03` to `05`, orders recorded in docs/verification.md B13). Newest first orders within the display sections (Overdue, Today, Upcoming, Completed), so an overdue task still appears above a newer one | VERIFIED |
| Filtering and categories | `app/src/domain/filters.ts`, `ui/FilterBar.tsx`, `ui/CategoryPicker.tsx` | Auto. Emu: Completed filter showed only the completed task; Active combined with category General showed only the matching task | VERIFIED |
| Backend auth and per-user ownership | `backend/src/routes/tasks.ts` (`owned()` filter in every query), auth middleware | Auto (security.test.ts). API: second user sees an empty list, PATCH and DELETE on the first user's task give 404, no token and garbage token give 401, the owner's task is intact (`server-isolation-and-errors.txt`) | VERIFIED |
| MongoDB persistence | Mongoose models, `backend/scripts/dev-local.ts` (real mongod, persistent `.devdata/db`) | Auto (mongodb-memory-server). Emu and API (Sprint 5): tasks created in the app, API and mongod fully stopped and restarted twice (mongod pid changed each time), same task ids and fields returned, and the app reopened after a force-stop showed the same tasks (`evidence/app-sprint5/server-before-restart.txt`, `server-after-restart.txt`, `09`) | VERIFIED |
| App and backend integration | `app/src/api/client.ts` (refresh on 401, one retry), `config/env.ts` | Emu: whole workflow above ran against the live backend over `10.0.2.2` | VERIFIED |
| Error handling and session recovery | `api/errors.ts`, `ui/ErrorBanner.tsx`, refresh rotation with grace window | Auto (client and API tests with mutation checks). Emu: earlier sprints (offline, 5xx, double submit, token expiry); this sprint force-stop restart kept the session. Refresh after the grace window and an interrupted rotation on a device are not reproduced | PARTIALLY VERIFIED |
| Hosted backend reachable by an evaluator | none | None exists. See limitations | BLOCKED |
| Signed release artifact | `android/app/build.gradle` (env-based signing) | No key exists; creation needs the owner | BLOCKED |

## Artifacts

| Artifact | Path | Size | SHA-256 | Notes |
|---|---|---|---|---|
| Debug APK | `app/android/app/build/outputs/apk/debug/app-debug.apk` | 90,292,276 bytes | `98DF253F17A73C0B41DE17AF54B65D14CBA7A2B2C71D85AB5A64DE4966C19875` | Built clean from commit `6df1057`, arm64-v8a and x86_64, debug-signed, **needs Metro**, the bundle is not embedded |
| Unsigned release APK | `app/android/app/build/outputs/apk/release/app-release-unsigned.apk` | 36,418,420 bytes | `95806C31385E6CB0C2942CA44AE8CAD0362AE382AE38A5E8EB993318414F3D2B` | Rebuilt this sprint, hash identical to the Sprint 3 build. Not signed, cannot be installed or uploaded, built with `-PallowEmptyApiUrl=true`. Permissions: INTERNET only (plus the app-private dynamic receiver permission). Not debuggable, bundle embedded, no `10.0.2.2` in the bundle |

APK files are build outputs and are git-ignored. Rebuild with the commands in `README.md`.

## Demo sequence (about five minutes)

1. Start `npm run dev:local` in `backend/`, `npm start` in `app/`, run `adb reverse tcp:8081 tcp:8081`, install the debug APK and open it.
2. Register a new account; see the empty list.
3. Create a High priority task with description, start date-time and a deadline.
4. Tick it complete; progress reaches 100 percent.
5. Edit it (change title and priority).
6. Add a task with a past deadline; use the sort menu and the Active, Completed, Overdue and category chips.
7. Delete a task from its menu.
8. Force-stop and reopen: still signed in, tasks remain.
9. Optional: `curl` the API with a second user to show 404 on another user's task.

## Limitations (stated plainly)

- No hosted backend. A local backend is not reachable by an external evaluator, who must run it themselves or be given a hosted URL.
- The debug APK cannot be used standalone; it loads JavaScript from Metro.
- No signed release and no Play readiness claim. `applicationId` is still the template value `com.todoapp`.
- TalkBack speech and a physical device were not verified. Hardware Tab order on the login form is non-sequential.
- One backend `api.e2e` suite-level failure occurred once under heavy machine load with all 84 tests reported passing. Sprint 5 could not reproduce that symptom and no original log exists, so it is UNRESOLVED. What was found instead: under saturating CPU load the suite fails with per-test 5 s timeouts (see docs/verification.md B13), and one lifecycle test had a polling loop longer than its own default timeout, which now has an explicit 30 s limit.
- During the emulator run the system showed transient "not responding" dialogs for the launcher and System UI because the host was under memory pressure; they were dismissed and did not involve the app.
- Three extra tasks for the sort and filter checks were created through the API as the same test user; the rest of the workflow used the UI.

- Sessions: the server keeps only the 5 newest sessions per user. Many API sign-ins for the same account (for example scripted `curl` logins during a demo) sign the app out with "Your session expired". Use a separate account for scripted checks.
- A transient red "Unable to load script" screen can appear if Metro is briefly unreachable; run `adb reverse tcp:8081 tcp:8081`, confirm `npm start` is running, and relaunch.
