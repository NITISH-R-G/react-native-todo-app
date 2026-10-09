# Verification

## Current state
- Milestone: M1 backend P0 done (API + real-MongoDB tests); RN app not started.
- Last known good commit: none (repo just initialised).
- Implemented (backend only): AUTH-001/002/003, TASK-001..006, API-001, DATA-001, SORT-001, FILT-001 (API), SEC-001 (partial: rate limiter configured but untested).
- Verified: API-001, DATA-001 (evidence §B1).
- Blocking: no system image / AVD yet (downloading cmdline-tools + image); Java default is 1.8 (use Android Studio JBR for Gradle).
- Next three actions: (1) backend auth + task API with real-MongoDB integration tests; (2) RN CLI scaffold + debug build; (3) reference APK screenshots on emulator.
- Known unverified claims: everything.

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
