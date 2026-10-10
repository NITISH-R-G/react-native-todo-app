# Verification

## Current state
- Milestone: Sprint 2 complete (edit, categories, filters, documented sort, session hardening, a11y pass).
- Last known good commit: see `git log` (Sprint 2 final commit); previous 6bc14f6.
- Implemented: AUTH-001/002/003, TASK-001..006, API-001, DATA-001, SEC-001 (partial), UI-001/002 (partial), FAIL-001 (partial).
- Verified: AUTH-001/002/003, TASK-001..006, API-001, DATA-001, SORT-001, FILT-001, CAT-001, UI-002, FAIL-001 (evidence B1, B3, B4, B5).
- Blocking: none. Dev setup: backend `npm run dev:local` (kill any older dev-local process first: two servers on :4000 silently serve stale code), Metro + `adb reverse tcp:8081 tcp:8081`, emulator ref35.
- Next three actions: (1) release build: https API URL, signing key outside repo, AAB; (2) TalkBack + keyboard traversal run, and a real-device pass; (3) hosting + Atlas + backups + privacy policy for Play.
- Known unverified claims: TalkBack announcements, rate limiter, CORS/TLS, 5xx screens on device, wavy progress/confetti (not built), release build, production backend, real physical device.

## Reference APK audit (2026-10-09) — `Mytasks-release.apk`
Evidence kept in `docs/evidence/reference-apk/` (manifest only).

| Command | Outcome |
|---|---|
| `Get-FileHash -Algorithm SHA256` | `DF5DA5BFE45911FF630160C9794552F8C3F3D8A42815320C9DB8727A32231F61`, 4,972,898 bytes |
| `aapt2 dump badging` | OBSERVED: `com.arjit.todo`, versionName 26.7.Beta, versionCode 3, minSdk 29, targetSdk 36 |
| `aapt2 dump permissions` | OBSERVED: BOOT_COMPLETED, POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM, USE_EXACT_ALARM, INTERNET, REQUEST_INSTALL_PACKAGES |
| `apksigner verify --print-certs` | OBSERVED: v2 only, signer `CN=Android Debug` |
| dex string scan (python) | OBSERVED: Kotlin/Compose/Material3/Room/Navigation-Compose; classes `MainActivity`, `TaskDao`, `domain.Task`, `domain.SubTask`, `ReminderBroadcastReceiver`, `BootReceiver` |
| `adb devices` / AVD check | BLOCKED: no device; system-images folder holds only `.installer` |

OBSERVED UI strings (dex): Add/Edit/Delete Task, Quick Task, Due Date, Due Time, Priority, Overdue, Completed/Not completed, Hide Completed, Sub-tasks, Categories (Manage/Add, icon), Search your tasks, "No tasks match your filters.", "No tasks for this day", One-time/Repeating task, Task Reminders, Theme & Colors, Theme Mode, Backup/Delete selected tasks, Check for Updates, Never miss a deadline, Stay on top of tasks.

INFERRED: bottom/rail navigation (adaptive navigation suite library), day/calendar view, bulk-selection mode.
UNKNOWN: layouts, colors, typography, shapes, motion, icons, interactive states (needs emulator run).
NOT PRESENT in reference: registration, login, backend.

## B1. Backend tests (2026-10-09)
Command: `cd backend && npx vitest run --testTimeout=60000 --hookTimeout=300000` -> exit 0, 2 files, **30 tests passed**, 43s.
- `tests/sort.test.ts` (5, unit): smart-score ordering and tie-break chain. Pure logic only.
- `tests/api.e2e.test.ts` (25): real `mongod` via mongodb-memory-server + real HTTP parsing via supertest; no app-code mocks. Covers register/login/dup (incl. case-variant and 3-way concurrent race), weak/malformed input, refresh rotation + reuse, forged/expired/wrong-type tokens, CRUD with direct-DB read-back, cross-user read/update/complete/delete, client-supplied userId, invalid dates, deadline<start (create and partial update), malformed id/JSON, filters + sort.
- Typecheck: `npx tsc --noEmit` exit 0.
- Mutation sanity check: removing `userId` from the ownership query made "user B cannot..." fail (`expected 200 to be 404`); restored, test passes. So the isolation test can fail.

Limitations: not tested - rate limiter, CORS, production TLS, offline/5xx client behaviour, app UI. The in-memory mongod is a real MongoDB but a single node; no replica-set/Atlas behaviour verified. `npm` reported `argon2` install script not run (allow-scripts); argon2 loaded and hashed correctly from its prebuilt binary in the tests.

## B2. Android debug build (2026-10-09)
Command: `cd app/android && JAVA_HOME=<Android Studio jbr> ANDROID_HOME=<sdk> ./gradlew.bat assembleDebug -PreactNativeArchitectures=x86_64` -> **BUILD SUCCESSFUL in 8m 40s** (87 tasks), output `app/android/app/build/outputs/apk/debug/app-debug.apk` (38,254,691 bytes).
- First attempt failed after 23m on `Connection reset` downloading `react-android-0.87.1-debug.aar` (network); retry succeeded from the Gradle cache.
- Scope: x86_64 only. This proves the unmodified RN 0.87.1 template compiles; it does NOT prove the app runs (not installed/launched yet) and contains no task features yet.
- Emulator note: Android 36.1 image crashes SurfaceFlinger (`hasReadColorBufferDma` assertion) under every GPU mode on this host; use the Android 35 AVD `ref35`.

## B3. Sprint 1 frontend + emulator acceptance (2026-10-09/10)
Environment: Android 35 x86_64 emulator `ref35`, custom APK `app/android/app/build/outputs/apk/debug/app-debug.apk` (61,139,284 bytes, built 23:39 by `./gradlew.bat assembleDebug -PreactNativeArchitectures=x86_64`, BUILD SUCCESSFUL in 17m49s, JAVA_HOME = Android Studio JBR). Installed fresh (`adb install -r`, `pm clear` before first launch). Backend: `npm run dev:local` (real persistent mongod on :27018, API :4000); app reaches it via `http://10.0.2.2:4000`. JS served by Metro (debug build).

Static / unit (commands run, results):
| Command | Result |
|---|---|
| `cd app && npx tsc --noEmit` | exit 0 |
| `cd app && npx eslint App.tsx src __tests__` | 0 errors, 6 warnings (react-native/no-inline-styles) |
| `cd app && npx jest` | 3 suites, **23 tests passed** |
| `cd backend && npx tsc --noEmit` | exit 0 |
| `cd backend && npx vitest run ...` (regression after config/dev-script change) | 2 files, **30 tests passed** |

Jest coverage (real stores/API client/screens; only native modules faked: keychain, datetimepicker, safe-area, icons; `fetch` replaced by a scripted server): validation rules mirror backend; grouping; refresh single-flight with rotating tokens; session cleared only on explicit refresh rejection (not on network error); register/login inline errors; server error + network failure messages; same-tick double submit sends one request (mutation check: removing the guard makes it fail with 2 calls); task form title/deadline validation; create sends all mandatory fields.
These are component/integration tests, not end-to-end.

Emulator acceptance (all executed on the device, evidence in `docs/evidence/app-sprint1/`):
| # | Step | Result | Evidence |
|---|---|---|---|
| 1 | Clean launch (`pm clear`) -> Login screen | PASS | 01-first.png |
| 2 | Register validation (empty submit) | PASS "Enter your email" / "Use at least 8 characters" | 03-register-validation-errors.png |
| 3 | Register new user `sprint1.<ts>@example.com` | PASS; pending state shown; lands on empty Home | 05a-register-pending.png, 05-home-empty.png |
| 4 | Task form validation (empty title) | PASS "Give your task a title" | 07-task-form-validation.png |
| 5 | Create task: title, description, High, deadline via native date+time dialogs | PASS | 08..11b-*.png |
| 6 | Appears in list with priority/date/deadline chips | PASS | 12-list-populated.png |
| 7 | Server read-back (login via curl, GET /tasks) | PASS: title, description, priority high, startAt, deadline 2026-10-11T19:21Z (= Oct 12 00:51 IST) | api-after-create.txt |
| 8 | Complete via checkbox | PASS UI (100%, snackbar+Undo); server `completed:true`, `completedAt` set | 13-completed-snackbar.png, api-after-complete.txt |
| 9 | Delete via menu + confirm dialog | PASS; server count 0 | 14-delete-confirm.png, 15-after-delete.png, api-after-delete.txt |
| 10 | Create 2nd task, `am force-stop`, relaunch | PASS: app returned signed in (Keychain session restore) with task present; first restart also restored session | 16-restart-session-restored.png, 17-after-restart-task-present.png, api-before-restart.txt |
| 11 | Sign out -> Login; wrong password | PASS "Invalid email or password", no crash | 18-account.png, 19-*.png, 20-login-wrong-password.png |
| 12 | Login with correct password | PASS; tasks shown | 21-login-success.png |
| 13 | Unauthenticated access: `GET /tasks` no token / bad token, `DELETE /tasks/<id>` no token | PASS 401 / 401 / 401 (curl) | recorded above |
| 14 | Dark theme | renders correctly | 22-dark-theme-list.png |

Notes / honest limitations:
- In step 10 my first attempt to create the persistence task silently did not reach the server (count 0) because the app was still loading its Metro bundle after a restart; I redid the step and confirmed on the server before the final restart. Debug restarts are slow because Metro re-bundles.
- Text entry used `adb input text` in 3-character chunks; fast typing dropped characters in a controlled field (test-harness effect, not investigated as an app bug).
- Not verified on device: real access-token expiry/refresh, offline and 5xx screens, task edit, rate limiter, TalkBack, 200% font scale, small screens, release build.
- Colours: "SAMPLED" values in `design/tokens.ts` come from reference screenshot pixels; dark scheme is derived, not observed.

## B4. Sprint 2 automated checks (final run)
| Command | Result |
|---|---|
| `cd backend && npx tsc --noEmit` | exit 0 |
| `cd backend && npx vitest run --testTimeout=60000 --hookTimeout=300000` | 2 files, **47 tests passed** (real mongod via mongodb-memory-server) |
| `cd app && npx tsc --noEmit` | exit 0 |
| `cd app && npx eslint App.tsx src __tests__` | 0 errors, 13 warnings (react-native/no-inline-styles) |
| `cd app && npx jest` | 8 suites, **101 tests passed** |
| `cd app/android && ./gradlew.bat assembleDebug -PreactNativeArchitectures=x86_64` | see B6 |

New distinct risks covered (and how they were checked):
- Sort precedence/ties: `backend/tests/sort.test.ts` 14-row table, each also run on reversed input, plus antisymmetry/transitivity over a mixed set. API-level composition of sort + filters in `api.e2e.test.ts`.
- Atomic refresh rotation: 4 concurrent redemptions of one refresh token -> exactly `[200,401,401,401]`. **Mutation check:** replacing the atomic `findOneAndUpdate` with read-then-write produced `[200,200,401,401]` and the test failed; restored.
- Multi-session: second login keeps first session; 6th session evicts oldest; logout revokes only its session and is idempotent.
- Cross-user: another user's PATCH of a task's tags -> 404 and DB unchanged.
- Client: edit prefill/cancel/validation/404-deleted; create double-submit (**mutation check:** removing the in-flight guard -> 2 POSTs, test fails); sign-out discards in-flight list (**mutation check** on the epoch guard); expired/revoked/offline boot; malformed 200/HTML 502; mutations attempted exactly once.
- Contrast: `contrast.test.ts` computes WCAG ratios for the real tokens (34 tests). It **found a defect**: medium-priority orange `#F57C00` was 2.31:1 on cards; replaced by `#B45F06` (3.9:1).
- A mutation check also showed one earlier edit-save test was vacuous (the store's busy guard hid a missing form guard); a create-path test was added that does fail without the guard.

## B5. Sprint 2 emulator evidence (`docs/evidence/app-sprint2/`)
Environment: Android 35 AVD `ref35`; backend dev API with `JWT_ACCESS_TTL=20s` so expiry/refresh happen within seconds; Metro debug bundle.
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Seeded tasks (overdue, completed, 4 categories, priorities) via API | smart order on device = predicted: Overdue invoice > Study for exam > Buy groceries > Persistence check > Call mom > Book flights | 01-list-with-filters.png, seed.mjs |
| 2 | Filters: Overdue; category Study; Study + Completed (empty-match state + Clear filters) | PASS | 03/04/05-*.png |
| 3 | Sort menu: Newest first / Nearest deadline / Smart | PASS orders matched (nearest deadline: Buy groceries before Study; no-deadline last) | 06-sort-menu.png, 07/08-*.png |
| 4 | Edit existing task (title, priority) | persisted: server read-back shows new title and `high` | api-after-edit.txt |
| 5 | New category "Errands" via the form, save | server `tags:["errands"]`; appears in filter row; filtering works | 11-category-added.png, api-new-category.txt, 17/18-*.png, api-hobbies.txt |
| 6 | Session: restart after access-token expiry | app stays signed in (silent refresh) x3 | (log in B5 notes) |
| 7 | Session: second client logs in as same user while device is signed in, token expired, device acts | device stays signed in, request succeeds | 14-multi-session-still-signed-in.png |
| 8 | Session: refresh token rejected | app signs out with "Your session expired" banner, no crash | 13-session-expired-notice.png |
| 9 | Offline: kill backend, pull-to-refresh | banner "Can't reach the server ... Showing your last loaded tasks" + Retry; list intact | 19-offline-banner.png |
| 10 | Offline: relaunch app with server down | stays signed in (session kept) | (state read in run) |
| 11 | Offline: create task | error under header, form content kept | 20-offline-create-error.png |
| 12 | Backend restored, same form saved again | list shown, session valid, **exactly one** "Created while offline" on server | 21-recovered-after-offline.png, api-after-offline-recovery.txt |
| 13 | Loading state | spinner captured at launch | 00-loading-state.png |
| 14 | 200% system font: Home, form | no overlap; segmented control stacks vertically; deadline chip no longer truncated | 23-font200-home.png, 24-font200-task-form.png |
| 15 | 360x640dp screen: Home, form | no horizontal overflow (0 text nodes beyond screen width); "Work" chip no longer clipped | 25/26/27-small-screen-*.png |
| 16 | Touch targets (uiautomator bounds / 2.625): form | 0 below 48dp after fixes; Home: only list rows partly hidden behind the bottom bar report <48dp (measurement artefact) | - |
| 17 | Accessible names + reading order | Home: 21 named interactive elements, 0 unnamed; form: title/description were unnamed -> labelled | - |

Defects found by device testing and fixed this sprint (none were caught by Jest):
1. **Keyboard hid the new-category field** (Android 15 edge-to-edge: window does not resize). Fix: `useKeyboardHeight` padding + scroll after `keyboardDidShow`.
2. **"New category" chip was at the far end of a scrolling row** (off-screen). Moved first; "Selected: X" line added.
3. **Fabric crash `addViewAt: child already has a parent`** (RedBox, reproduced 3/3) when saving a task with a brand-new category (chip inserted mid-row). `collapsable={false}` did NOT fix it; remounting chip rows via a content key did (verified; 15-redbox-addViewAt.png).
4. **Single refresh slot per user**: any second sign-in (even my own verification script) silently signed the device out. Replaced by multi-session store + atomic rotation + `/auth/logout`.
5. Form error was below the fold; moved under the header.
6. Touch targets (sort/back 38dp, Add/Save 44dp, deadline switch 27dp) and large-font/small-screen chip clipping.
7. Medium-priority color contrast (see B4).
Testing-process lesson recorded: two dev API servers were running (stale code kept answering on :4000); I verified the live server by behaviour (session count after two logins) before trusting any device result.

Known limitation: refresh tokens are single-use. If the app is killed between the server rotating the token and the app saving the new one (e.g. process kill mid-refresh), that session cannot refresh and the user signs in again (shown with the "session expired" notice). Reasonable for security; a grace window would weaken reuse detection.
Offline support: the list is a read-only cache while offline; creating/editing/deleting offline and later syncing is NOT implemented.

## B6. Android debug build gate (Sprint 2)
`cd app/android && ./gradlew.bat assembleDebug -PreactNativeArchitectures=x86_64` -> **BUILD SUCCESSFUL in 48s**, exit 0.
Scope: no native dependency or Android file changed in Sprint 2 (all changes are JS/TS), so Gradle reused its previous outputs; the APK (`app-debug.apk`, 61,139,284 bytes, 2026-10-09 23:39) is the Sprint 1 binary and the new JS is served by Metro in debug. This confirms the project still builds; it does not exercise a bundled (release) JS build, which remains part of REL-001.
