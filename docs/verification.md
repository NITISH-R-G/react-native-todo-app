# Verification

## Current state
- Milestone: M1 backend P0 done (API + real-MongoDB tests); RN app not started.
- Last known good commit: 2df3161 (+ debug build recorded in B2).
- Implemented (backend only): AUTH-001/002/003, TASK-001..006, API-001, DATA-001, SORT-001, FILT-001 (API), SEC-001 (partial: rate limiter configured but untested).
- Verified: API-001, DATA-001 (evidence §B1).
- Blocking: none. Gradle needs JAVA_HOME = Android Studio JBR; emulator must be the Android 35 AVD `ref35`.
- Next three actions: (1) theme tokens + auth/task screens; (2) install on ref35 and run register-to-delete flow against the API; (3) sample palette/type from reference screenshots.
- Known unverified claims: all frontend/app requirements, rate limiting, emulator/visual/a11y, release build.

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
