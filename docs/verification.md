# Verification

## Current state
- Milestone: Sprint 3 complete (durability, security audit, release configuration, deployment readiness, account deletion). Conditionally ready: see B11.
- Last known good commit: see `git log` (Sprint 3 final commit); previous baeae04.
- Implemented: AUTH-001/002/003, TASK-001..006, API-001, DATA-001, SEC-001 (partial), UI-001/002 (partial), FAIL-001 (partial).
- Verified: see requirements.md (VERIFIED / PARTIALLY VERIFIED / NOT VERIFIED / BLOCKED).
- Blocking for Play release: no signing key, no production API URL, no hosted backend, no privacy policy or deletion web URL, applicationId changed from the template value `com.todoapp` to the owner-approved `com.nitishrg.todo` in Sprint 6 (store availability not checked).
- Next three actions: (1) decide hosting and applicationId, create the upload key yourself, set PRODUCTION_API_URL; (2) deploy the backend and run the smoke flow against the real URL; (3) manual TalkBack pass on a physical device, then signed AAB.
- Known unverified claims: TalkBack speech and swipe order, physical-device behaviour, real TLS and hosted CORS, Docker image, signal-based shutdown on Linux, signed artifact and AAB, signed-in screens under R8 minification, interrupted-rotation on a device.

## Reference APK audit (2026-10-09) - `Mytasks-release.apk`
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

Known limitation: refresh tokens are single-use. If the app is killed between the server rotating the token and the app saving the new one (e.g. process kill mid-refresh), that session cannot refresh and the user signs in again (shown with the "session expired" notice). Reasonable for security; a grace window would weaken reuse detection. Superseded in part by B7 (Sprint 3): a short idempotent grace window now recovers a quick reopen; reopening after the window still requires signing in.
Offline support: the list is a read-only cache while offline; creating/editing/deleting offline and later syncing is NOT implemented.

## B6. Android debug build gate (Sprint 2)
`cd app/android && ./gradlew.bat assembleDebug -PreactNativeArchitectures=x86_64` -> **BUILD SUCCESSFUL in 48s**, exit 0.
Scope: no native dependency or Android file changed in Sprint 2 (all changes are JS/TS), so Gradle reused its previous outputs; the APK (`app-debug.apk`, 61,139,284 bytes, 2026-10-09 23:39) is the Sprint 1 binary and the new JS is served by Metro in debug. This confirms the project still builds; it does not exercise a bundled (release) JS build, which remains part of REL-001.

## B7. Sprint 3 refresh-token durability (workstream A)
Root cause (reproduced with a probe test before changing code): rotation is a single atomic update on the server, so the old refresh token is dead the instant the new one is issued. If the response never reaches the app (process killed, secure-storage write failed), the app still holds the old token; on the next launch the server answers 401 and the user must sign in again. Probe: refresh, discard the response, refresh again with the old token -> 401.
Design chosen (decisions.md D19): per session the server remembers the previous token hash and the rotation time. Within `REFRESH_REUSE_GRACE_SECONDS` (default 30, 0 disables) re-presenting that previous token re-delivers the SAME replacement token (re-signed deterministically from the stored jti and issue time). Nothing is rotated or created by the retry. The previous token is dead once the replacement is redeemed (two generations old), when the grace expires, or when the session is logged out or evicted. Only one previous generation is remembered.
Client: secure-storage write failure after a successful refresh keeps the new tokens in memory, still completes the user's request, and retries the write after the next healthy request.
Security reasoning: a thief holding a stale token can obtain the replacement only within the grace window and only if the legitimate client has not yet used it; both then hold the same token and the next rotation invalidates the loser. A stolen LIVE token is always game over, with or without grace. No path accepts a token two generations old, a token of another user, or a token after logout or eviction.
Tests (backend `api.e2e.test.ts`, client `apiClient.test.ts`): lost response is re-delivered identically and the session keeps rotating; replay after the replacement was used is 401; grace expiry (real clock); grace disabled = strict single use; logout revokes the recoverable previous token; eviction cannot be recovered through grace; cross-user isolation; 4 concurrent redemptions give one rotation and one identical replacement. Mutation checks: dropping the grace time bound failed the expiry test; replacing the atomic update with read-then-write failed the single-rotation test; removing the client persistence retry failed the persistence test.
Remaining risk (stated accurately): the app must be reopened within the grace window (default 30 seconds) after an interrupted rotation, otherwise the user signs in again. Interrupted rotation was not reproduced on a device (tests simulate the lost response and the failed write). Sessions created before this change have no stored jti and are not recoverable until their next rotation.

## B8. Sprint 3 backend security audit (workstream B)
Commands run: `cd backend && npx tsc --noEmit` (exit 0); `npx vitest run` (4 files, **84 tests passed**); `npm audit` (0 vulnerabilities, production and all); `npm run build` then `node scripts/smoke-prod.mjs` (compiled server with production-style env against a real mongod: 8 checks passed).
| # | Finding | Severity | Evidence | Remediation | Remaining risk |
|---|---|---|---|---|---|
| S1 | Auth-limiter keyed by IP with no proxy setting: behind a hosting proxy every user would share one bucket | Medium | read of app.ts; test with X-Forwarded-For | `TRUST_PROXY` hop count; tests prove spoof resistance and per-client limits | must be set correctly on the real host |
| S2 | No limit on the task API | Medium | read of app.ts | per-user limiter (300/min) after authentication; test | tune with real traffic |
| S3 | MongoDB failure at startup unhandled, error text could expose a connection string | Medium | read of server.ts | `startServer` fails fast with credential-redacted message; tests | none known |
| S4 | No readiness endpoint, no graceful shutdown | Medium | read of server.ts | `/ready` (503 when the database is gone), `close()` drains then disconnects; tests | signal delivery on Linux not tested (dev machine is Windows) |
| S5 | Access and refresh secrets could be identical | Low | read of config.ts | startup refuses identical or short secrets; test | none |
| S6 | No request logging | Low | read of app.ts | JSON lines (method, full path, status, ms), no query, body or headers; test. The smoke run found a bug (mount-relative path logged) and it was fixed | log shipping is a platform job |
| S7 | Registration reveals whether an email exists (409) | Info | test | accepted: usability; login is uniform and timing-equalized | enumeration possible via register |
| S8 | Access tokens cannot be revoked for up to their TTL (15 min) after logout or deletion | Info | design | deletion also blocks task creation for a deleted user (test); refresh is revoked immediately | read access until expiry |
| S9 | `npm audit` for the app reports 21 high findings, all from `braces` (glob DoS) via Metro, the React Native CLI and Jest | Info | `npm audit --json`: single advisory; `braces` is already at the latest 3.0.3 | no fix exists upstream; build tooling only; not in the shipped bundle (the string "braces" in the bundle is Material icon names) | developer machine only |
| S10 | Template `debug.keystore` is tracked | Info | git ls-files | verified (2026-10-17) byte-identical (SHA-256 `221e0a31...5e58`) to `android/app/debug.keystore` in the published `@react-native-community/template` 0.87.1, 0.86.0 and 0.84.0, so it is the public template key (public certificate fingerprint only was read; no private material printed). `app/android/app/build.gradle` uses it as `signingConfigs.debug` for the debug build type, so it stays tracked; removing it would break `assembleDebug`. `*.keystore` is gitignored so release keys cannot be committed by accident | none |
Verified clean: every protected route needs a valid access token (including alg=none and wrong-key tokens); operator-object injection in bodies and queries cannot widen results; oversize and prototype-pollution bodies refused; one error envelope with no stack or driver text; no hash, session record or secret in any response; passwords only as argon2id, refresh tokens only as SHA-256; helmet headers present and `x-powered-by` absent; CORS closed by default and allowlist-only; secrets are not in tracked files or git history (pattern scan). Mutation checks: removing the auth middleware, ignoring trust proxy and opening CORS each failed the suite.
Not verified (no relevant environment): real TLS, CORS behind the real host, production monitoring, hosted MongoDB behaviour.

## B9. Sprint 3 release configuration and accessibility (workstreams C and D)
Release configuration findings:
| # | Finding | Severity | Remediation |
|---|---|---|---|
| R1 | Release build type was signed with the DEBUG key (template default) | High | signing now comes only from `TODO_UPLOAD_*` Gradle properties or environment; without them the artifact is unsigned and a warning is printed; never falls back to debug |
| R2 | Merged manifest requested USE_BIOMETRIC and USE_FINGERPRINT (from react-native-keychain) though the app never uses biometrics | High (Play disclosure) | removed with `tools:node="remove"`; permission list is INTERNET only (verified with aapt2) |
| R3 | No account deletion although accounts can be created | High (Play) | implemented and verified (PRIV-001) |
| R4 | Production URL could not be enforced | High | `src/config/productionApiUrl.ts` is empty in source; `scripts/check-release-config.mjs` runs before assembleRelease, bundleRelease and packageRelease and fails on empty, http, local or private hosts, trailing slash or credentials; `-PallowEmptyApiUrl=true` bypasses it for packaging verification only; the app shows a "Not configured" screen for such a build (ConfigGate) |
| R5 | R8 minification disabled | Medium | enabled with resource shrinking; minified build smoke-tested |
| R6 | applicationId was the template value `com.todoapp` and cannot change after publishing | Decision | RESOLVED in Sprint 6: owner approved `com.nitishrg.todo` (see B14); not yet published anywhere |
Release build evidence: see `docs/evidence/app-sprint3/release-artifact.txt`. Artifact: `app/android/app/build/outputs/apk/release/app-release-unsigned.apk`, 36,418,420 bytes, SHA-256 95806C31385E6CB0C2942CA44AE8CAD0362AE382AE38A5E8EB993318414F3D2B. Two clean builds of identical source gave identical SHA-256. An unsigned APK cannot be installed and must not be uploaded.
Minified smoke run (throwaway build with the reserved host `https://api.invalid`, signed with the public template debug key outside the repository, source reverted afterwards): launched without Metro on the emulator, login screen rendered, typing and the password toggle worked, "Signing in..." state shown, the network error message appeared for the unresolvable host, process stayed alive (`31-release-smoke-offline-error.png`). NOT covered under R8: signed-in screens (task form, date pickers, menus, dialogs), because a real https API was unavailable.
Accessibility and device checks:
- Keyboard: IME Next on the email field did not move focus (the keyboard closed). Fixed; verified on device (focus moves to Password, form not submitted). Hardware Tab order on the login form is Email, Sign in, Show password, Create account, Password: reproducible, caused by native view order of Paper's composed inputs; not fixed to avoid a library workaround. PARTIAL.
- Delete-account dialog: the soft keyboard covered its buttons and error text (Android edge-to-edge does not resize). Fixed by centering the dialog above the keyboard; verified on device.
- TalkBack: enabled on the emulator, service bound, focus ring observed, Email field focused exactly. Speech output and full swipe order could not be captured through adb. NOT VERIFIED for A11Y-002.
- Reduced motion: `useReduceMotion` honoured by the progress bar and checkbox spring; verified in Jest only.
- Earlier evidence still applies (Sprint 2 B5): 48dp targets, labels, 200% font, 360x640dp.
Manual TalkBack procedure (physical device or emulator, about 10 minutes): (1) Settings > Accessibility > TalkBack on. (2) Open the app; swipe right through the login screen and confirm the order Welcome back, Sign in to pick up, Email, Password, Show password, Sign in, Create an account, and that each control is announced with its name and role. (3) Submit empty: confirm the validation messages are announced. (4) Sign in; on Home confirm Progress is announced as a progress bar with a percentage, each task card announces checkbox state and title, "Mark complete" toggles with a state announcement. (5) Open the delete-task confirmation and the delete-account dialog: confirm the title is announced and the focus stays inside the dialog. (6) Settings > Display > Font size and Display size to maximum: repeat step 4 and check nothing is cut off. (7) Settings > Accessibility > Remove animations: complete a task and check the bar jumps without animating.

## B10. Sprint 3 final gates (frozen source)
| Command | Result |
|---|---|
| `cd backend && npx tsc --noEmit` | exit 0 |
| `cd backend && npx vitest run --testTimeout=60000 --hookTimeout=300000` | 4 files, **84 passed** |
| `cd backend && npm run build && node scripts/smoke-prod.mjs` | build ok; 8 of 8 smoke checks passed |
| `cd app && npx tsc --noEmit` | exit 0 |
| `cd app && npx eslint App.tsx src __tests__ metro.config.js` | 0 errors, 17 style warnings |
| `cd app && npx jest --no-cache` | 11 suites, **121 passed** (cold cache) |
| `cd app/android && ./gradlew.bat assembleDebug -PreactNativeArchitectures=x86_64` | BUILD SUCCESSFUL in 20s (mostly cached; JS is served by Metro in debug) |
| `cd app/android && ./gradlew.bat assembleRelease -PallowEmptyApiUrl=true -PreactNativeArchitectures=arm64-v8a,x86_64` | BUILD SUCCESSFUL in 1m 16s, unsigned |
Baseline defects found while re-running Sprint 2 checks: one app test (`useReduceMotion`) exceeded Jest's 5 second default on a cold cache; the default timeout is now 20 seconds. A second test that required the whole App graph exceeded 20 seconds cold; the decision moved into a small `ConfigGate` component that is tested directly. Metro could not start its file watcher while Gradle was compiling native code; Android build folders are now excluded in `metro.config.js`.

## B11. Release status summary
- Debug build: verified.
- Release build: unsigned APK builds and runs (minified smoke on emulator); not shippable.
- Signed artifact: BLOCKED (no key; needs your approval and your own key).
- Production API configuration: gate verified; the URL itself is empty and needs your hosting decision.
- Hosted backend: NOT DEPLOYED.
- Physical device and TalkBack: NOT VERIFIED.
- Play Store readiness: NOT READY (signing, URL, hosting, privacy policy and deletion web URL, applicationId, Play Console forms, physical-device and TalkBack pass).

## B12. Sprint 4 finalization (2026-10-17)

Source: commit `6df1057` plus README, `app/jest.warmup.js` and `app/jest.config.js` (this sprint's commit). Full matrix and artifact table: `docs/acceptance.md`. Evidence: `docs/evidence/app-sprint4/`.

- Backend: `tsc --noEmit` exit 0; Vitest 84 of 84 passed in 4 files (several runs, including three back to back under concurrent Jest load).
- App: `tsc --noEmit` exit 0; ESLint 0 errors, 17 warnings; Jest 121 of 121 passed in 11 suites, including a cold-cache run under concurrent load.
- Jest warm-up fix: the first `render()` of a test file paid cold module loading inside the test body and sometimes exceeded the timeout (`useReduceMotion` test, reproduced with `--no-cache` and under load). `app/jest.warmup.js` (run via `setupFilesAfterEnv`) loads those modules before the first test. No assertion, test or timeout was weakened; the earlier `testTimeout` of 20000 is unchanged.
- One unreproduced event: `tests/api.e2e.test.ts` reported a suite-level failure once while all 84 tests passed, during a heavily loaded run. Not reproduced in later runs; cause unknown.
- Debug APK: clean build, 90,292,276 bytes, SHA-256 `98DF253F17A73C0B41DE17AF54B65D14CBA7A2B2C71D85AB5A64DE4966C19875`, installed on the emulator and run against Metro (`npm start`) and the dev backend.
- Emulator workflow on that APK: register, create (title, description, date-time, deadline, priority), complete, edit, force-stop restart (session and data kept), smart sort, status and category filters, delete, each with a server read-back; second-user isolation and 401, 400 and 404 responses checked with curl.
- Unsigned release APK: rebuilt (`assembleRelease -PallowEmptyApiUrl=true`, two ABIs), 36,418,420 bytes, SHA-256 `95806C31385E6CB0C2942CA44AE8CAD0362AE382AE38A5E8EB993318414F3D2B`, identical to the Sprint 3 build. `apksigner verify` reports it unsigned. Not installed or run in this sprint.
- `git diff --check` clean. Secret scan: no keys or credentials; the only match is a deliberately fake connection string in `backend/tests/lifecycle.test.ts`. `PRODUCTION_API_URL` is still empty. The tracked `app/android/app/debug.keystore` is the public React Native template debug key, not a release key.
- Not exercised: `npm run android`, physical device, TalkBack speech, hosted backend.

## B13. Sprint 5 final verification (2026-10-17)

Provenance: the debug APK was built from `6df1057`; the unsigned release APK was built from a tree equal to `6df1057` at the runtime level. `git diff 6df1057 e612582` touches no file under `app/src`, `app/android`, `app/App.tsx`, `app/package*.json`, `backend/src` or `backend/package*.json` (only README, docs, evidence, `app/jest.config.js`, `app/jest.warmup.js`). Both APKs are therefore valid for the current runtime source and were not rebuilt. Sprint 5 changed only test files (`backend/tests/api.e2e.test.ts`, `backend/tests/lifecycle.test.ts`, `app/jest.setup.js` lint header) and docs.

**A. Newest first.** Three tasks were created through the UI as the dedicated user `s5.demo` with different priorities, deadlines and creation times. Backend and UI orders, per mode:

| Mode | Backend `?sort=` order | Order shown in the app |
|---|---|---|
| Smart | Bravo, Charlie, Alpha | Bravo, Charlie, Alpha |
| Nearest deadline | Bravo, Alpha, Charlie | Bravo, Alpha, Charlie |
| Newest first | Charlie, Bravo, Alpha (createdAt 13:37:30, 13:36:17, 13:34:15 UTC) | Charlie, Bravo, Alpha |

A first read of Newest first happened before the re-fetch finished on the slow emulator and showed the previous order; a read 12 seconds later was correct. The list is grouped into sections (Overdue, Today, Upcoming, Completed), so Newest first applies inside each section. `sort=created` had no backend test; one was added (it also asserts that the smart order differs) and fails when `created` is mapped to smart (mutation checked).

**B. Persistence after restart.** Dedicated user `s5.demo`. Tasks created in the app, read back through the API, then the API and mongod were killed and `npm run dev:local` was started again on the same `.devdata` (mongod pid 38392, then 33268, then 8156). Task ids and fields were identical before and after (`docs/evidence/app-sprint5/server-before-restart.txt`, `server-after-restart.txt`). After the second restart the app was force-stopped and reopened and still showed the same two tasks, signed in. No unrelated data was touched. Side finding: a first relaunch showed "Your session expired" because scripted `curl` logins for the same user had pushed the app's session out of the 5-session window; this is the designed limit, not a restart effect, and was reproduced by sign-in counting rather than by instrumenting the server.

**C. Intermittent `api.e2e` suite failure.** UNRESOLVED. No original output exists. Hooks in `api.e2e`/`security` use `MongoMemoryServer.create()` in `beforeAll` (300 s limit) and `mongod.stop()` in `afterAll` (Vitest default hook limit). Attempts: 3 runs at 24 busy loops on 12 cores gave 14 to 16 per-test timeouts of 5000 ms (rate-limit, injection and deletion tests in `security`, plus others); 2 runs at 12 busy loops gave 3 and 7 per-test timeouts; 3 full runs without added load passed 85 of 85, one run immediately after the load runs failed one `lifecycle` test ("reports not-ready (503) when the database goes away") with a 5000 ms timeout. That test polls up to 20 x 300 ms plus starting and stopping mongod, so its own budget could exceed the default; it now carries an explicit 30000 ms timeout. After that change the lifecycle file passed twice on its own and the full suite passed 85 of 85 once more in the final gate run (4 clean full runs in total, none of them under added load). No assertion was changed and no global timeout was raised. The original symptom (all tests passed, suite reported failed) was not reproduced, so no root cause is claimed; the suite is CPU-load sensitive and is only reliable on a machine that is not saturated.

**Gates (run sequentially, no added load):** backend `tsc --noEmit` exit 0; backend Vitest exit 0, 4 files, 85 of 85 tests; app `tsc --noEmit` exit 0; app ESLint exit 0 with 0 errors and 17 warnings (a run before the change reported 9 `'jest' is not defined` errors in `app/jest.setup.js`, a file unchanged since the first app commit; the Sprint 4 report of 0 errors could not be reproduced for that state, so `/* eslint-env jest */` was added to that file); app Jest exit 0, 11 suites, 121 of 121 tests (Jest also prints "A worker process has failed to exit gracefully", a pre-existing open-handle warning); `git diff --check` exit 0. No Android build was run: no runtime source changed.

**Demo coverage this sprint (emulator, dedicated user):** register, sign in (UI), sign out, create three tasks, complete, edit priority, three sort modes, delete, force-stop, backend restart. Status and category filters were verified in Sprint 4 on the same code. No physical device, TalkBack or hosted backend.

## B14. Sprint 6 app identity migration (2026-10-17)

Owner-approved identity: display name `To-Do`; Android namespace and applicationId `com.nitishrg.todo`; iOS bundle identifier `com.nitishrg.todo`. Previous: `TodoApp`, `com.todoapp`, and the iOS template identifier `org.reactjs.native.example.$(PRODUCT_NAME:rfc1034identifier)`. Availability of the new identifiers on either store was NOT checked, and nothing was published.

Changed: `app/android/app/build.gradle` (namespace, applicationId); Kotlin package declarations and directory (`com/todoapp` moved to `com/nitishrg/todo` with `git mv`); `strings.xml` app_name; `app/app.json` displayName; iOS `Info.plist` CFBundleDisplayName, `LaunchScreen.storyboard` label, and `PRODUCT_BUNDLE_IDENTIFIER` in both build configurations of `project.pbxproj`; README and docs.

Deliberately unchanged: the React component name `TodoApp` (app.json `name`, `MainActivity.getMainComponentName`, iOS `withModuleName`) and the Xcode project, target, scheme and Gradle `rootProject.name`, because they are internal identifiers that are not user visible and are consistent with each other; the manifest uses relative class names so it needed no edit.

Results in this pass: Android debug build FAILED once with `package com.todoapp does not exist` in the generated `ReactNativeApplicationEntryPoint.java`. Cause: ignored caches under `app/android/build/generated/autolinking` (an `autolinking.json` from 2026-10-10 holding the old packageName) and `app/android/app/build/generated/autolinking` that Gradle did not invalidate. Deleting those two ignored directories and rebuilding gave BUILD SUCCESSFUL in 3m 14s. The resulting APK: package `com.nitishrg.todo`, label `To-Do`, launchable activity `com.nitishrg.todo.MainActivity`, targetSdk 36, zero entries under `com/todoapp`, 90,292,280 bytes, SHA-256 `C6E6959741B6CE24B5D05ECEBB108DCA44E6A1D8BA8331670363F5A5080223C6`. Debug-only extra permissions in that APK are `SYSTEM_ALERT_WINDOW` and `ACCESS_LOCAL_NETWORK`; the release manifest was not rebuilt.

App `tsc --noEmit` exit 0; ESLint exit 0 (0 errors, 17 warnings); Jest exit 0 (11 suites, 121 of 121); `git diff --check` exit 0. Backend was not changed and its tests were not re-run in this pass (last run: 85 of 85 during the readiness audit earlier on 2026-10-17, before this change).

Not verified: installing and launching the new debug APK on an emulator, an unsigned release rebuild, and any iOS build (no macOS or Xcode here; the iOS edits were checked only by reading the files). The earlier emulator evidence was produced with the old application ID.

## B15. Sprint 7 standalone demo APK (2026-10-18)

Built from commit `e7fe195`: a `--dev true` bundle was generated into `android/app/src/main/assets` (6,128,333 bytes) and `assembleDebug` ran (BUILD SUCCESSFUL, 1m 19s). No source file was changed and the temporary generated files were removed afterwards (`git status` clean). APK: 97,765,978 bytes, SHA-256 `04732EE994827405C6101643EE1E99557C5476EAFE161FC5A37DB825F0F9390E`, package `com.nitishrg.todo`, label `To-Do`, `assets/index.android.bundle` present, `apksigner verify` reports a valid v2 debug signature.

Emulator run (Android 35 x86_64 AVD, headless) of that exact file with NO Metro process and `adb reverse --remove-all`: the old `com.todoapp` build was uninstalled, the APK installed, the app rendered the sign-in screen, a new user was registered in the UI, a task with priority High and a deadline was created in the UI, and the task was ticked complete in the UI. Server read-backs through the authenticated API showed the task with priority `high`, a deadline set, and later `completed:true` with a `completedAt` timestamp. The emulator text injection garbled the typed email and one title character (the account became `rreview@example.com` and the title `PPrepare report`); this is an `adb input` artifact on a slow emulator, not an app defect. Edit, sort, filter, delete and restart persistence were not re-run on this APK; they were verified on the same source with the previous identity (B13).

Not verified: a physical device (the app targets `10.0.2.2`, so it cannot reach a backend from a phone), iOS, any hosted backend.
