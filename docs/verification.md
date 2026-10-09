# Verification

## Current state
- Milestone: Sprint 1 vertical slice (register, login, task CRUD, persistence) verified on emulator.
- Last known good commit: 2df3161 (+ debug build recorded in B2).
- Implemented: AUTH-001/002/003, TASK-001..006, API-001, DATA-001, SEC-001 (partial), UI-001/002 (partial), FAIL-001 (partial).
- Verified: AUTH-001, AUTH-002, TASK-001..005, API-001, DATA-001 (evidence B1, B3).
- Blocking: none. Debug build needs Metro (`npx react-native start`) + `adb reverse tcp:8081 tcp:8081` and the dev API (`cd backend && npm run dev:local`).
- Next three actions: (1) release build + https API URL config + signing; (2) filters/categories UI + edit/error/offline states exercised on device; (3) accessibility run (TalkBack, 200% font) and small-screen check.
- Known unverified claims: token expiry/refresh on device, offline and 5xx UI on device, edit task on device, rate limiter, TalkBack/font scaling, small screens, release build, production backend.

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
