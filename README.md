# To-Do App (React Native + Node.js + MongoDB)

An Android task manager: register, sign in, create tasks with a description, start date-time, deadline and priority, then complete, edit, filter, sort and delete them. Tasks are stored on a Node.js/Express API in MongoDB, and every request is scoped to the signed-in user on the server.

```
app/       React Native CLI 0.87 + TypeScript Android app (Material 3 style UI, react-native-paper)
backend/   Node.js + Express + Mongoose + Zod API (JWT access tokens, rotating refresh tokens, argon2id)
docs/      requirements, architecture decisions, verification evidence, deployment notes
```

Source: https://github.com/NITISH-R-G/react-native-todo-app (`git clone https://github.com/NITISH-R-G/react-native-todo-app.git`, branch `master`). APK files are not in the repository; build them as described below.

## Status (read this first)

- Runs locally: the app on an Android emulator or device, the API and MongoDB on your machine.
- There is **no hosted backend**. An evaluator cannot use this app without running the backend on a machine the phone or emulator can reach. See "Reaching the backend from Android".
- The debug APK does **not** contain the JavaScript bundle. It loads it from Metro (`npm start`) while you run the app, so it cannot be installed and used on its own. An emulator-only build with the bundle embedded is described under "Demo APK that runs without Metro".
- The Android application ID and iOS bundle identifier are `com.nitishrg.todo` and the display name is "To-Do". These were chosen by the owner and have not been checked for availability on Google Play or the App Store, and nothing has been published. This is a local-demo submission, not an independently evaluable or production-ready release. iOS has never been built.
- No signed release exists and none should be assumed. See `docs/deployment.md` and `docs/verification.md` for what is and is not verified.

## Requirements

| Software | Version | Notes |
|---|---|---|
| Node.js | 24.x (22.11 or newer works for the app) | `node -v` |
| npm | 11.x | ships with Node |
| JDK | 17 or newer | Android Studio's bundled JBR works. A default JDK 8 will fail the Gradle build |
| Android SDK | platform 36 and 37, build-tools 37, NDK 27.1.12297006 | Android Studio installs these; Gradle can fetch missing ones after you accept licences |
| Android emulator or device | Android 7.0 (API 24) or newer, x86_64 or arm64-v8a | on Windows the emulator needs WHPX or HAXM |
| MongoDB | optional | `npm run dev:local` starts a real mongod for you; otherwise use your own MongoDB 6+ |

Set these once per shell (Windows PowerShell example):

```powershell
$env:JAVA_HOME    = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
```

## 1. Backend and MongoDB

```bash
cd backend
npm ci
```

Option A: no MongoDB install needed (recommended for a demo). This downloads and runs a real `mongod` on port 27018, keeps its data in `backend/.devdata/` (git-ignored), generates throwaway JWT secrets there, and starts the API on port 4000:

```bash
npm run dev:local
```

Option B: your own MongoDB. Copy `backend/.env.example` to `backend/.env` and fill in the placeholders:

| Variable | Required | Meaning |
|---|---|---|
| `MONGODB_URI` | yes | for example `mongodb://127.0.0.1:27017/todo` |
| `JWT_ACCESS_SECRET` | yes | 32 or more random characters |
| `JWT_REFRESH_SECRET` | yes | 32 or more random characters, different from the access secret |
| `PORT` | no | default 4000 |
| `TRUST_PROXY` | no | reverse-proxy hops in front of the API (0 locally) |
| `REQUIRE_HTTPS` | no | `true` behind a TLS proxy; needs `TRUST_PROXY` of 1 or more |
| `CORS_ORIGINS` | no | leave empty; the native app sends no Origin |
| `JWT_ACCESS_TTL`, `REFRESH_REUSE_GRACE_SECONDS`, `AUTH_RATE_LIMIT_MAX`, `API_RATE_LIMIT_MAX`, `LOG_REQUESTS`, `MONGO_SERVER_SELECTION_TIMEOUT_MS` | no | defaults and meaning are in `.env.example` |

Generate secrets yourself, for example `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, and never commit `.env`. Then run `npm run dev` (auto-restart) or `npm run build && npm start`.

Check that it is up:

```bash
curl http://127.0.0.1:4000/health    # {"ok":true}
curl http://127.0.0.1:4000/ready     # {"ready":true} once MongoDB answers
```

Only one API process may listen on port 4000. A stale old one will silently keep serving old code; stop it first if behaviour looks wrong.

## 2. Reaching the backend from Android

Debug builds call `http://10.0.2.2:4000`, which is the Android **emulator's** alias for your computer. Nothing else is needed for an emulator.

For a **physical phone**: put it on the same Wi-Fi, allow port 4000 through your firewall, and change the one debug URL in `app/src/config/env.ts` (the `'http://10.0.2.2:4000'` literal) to `http://<your-computer-LAN-IP>:4000`. Alternatively run `adb reverse tcp:4000 tcp:4000` and use `http://localhost:4000`. Plain HTTP is allowed only in debug builds.

Release builds never use that URL. They use `PRODUCTION_API_URL` in `app/src/config/productionApiUrl.ts`, which is intentionally empty; a release without a valid public https URL is refused by the build (see "Release builds").

## 3. Run the Android app

```bash
cd app
npm ci
npm start                       # terminal 1: Metro, leave it running
```

In a second terminal, with an emulator running or a phone connected (`adb devices`), build the debug APK (section 4), then:

```bash
adb reverse tcp:8081 tcp:8081   # lets the app reach Metro
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.nitishrg.todo/.MainActivity
```

If an older build with the previous ID `com.todoapp` is installed on your emulator it is a separate app; remove it with `adb uninstall com.todoapp`. This is the path that was exercised end to end on an emulator (with the previous ID; the new ID was build-verified, see docs/verification.md B14). `npm run android` (React Native CLI build, install and launch in one step) is the standard alternative but was not exercised in this verification.

The first Gradle build compiles native code and can take 15 to 35 minutes; later builds take about a minute. On a slow machine the first launch downloads the bundle from Metro for up to a minute or two and the emulator may show a transient "not responding" dialog from another app; choose Wait.

## 4. Tests and builds

| What | Command (run in the folder shown) | Expected |
|---|---|---|
| Backend typecheck | `cd backend && npm run typecheck` | exit 0 |
| Backend tests (real MongoDB) | `cd backend && npm test` | all pass; the first run downloads a mongod binary |
| App typecheck | `cd app && npx tsc --noEmit` | exit 0 |
| App lint | `cd app && npm run lint` | 0 errors (style warnings only) |
| App tests | `cd app && npm test` | all pass |
| Compiled-server smoke test | `cd backend && npm run build && node scripts/smoke-prod.mjs` | `smoke ok` |

Debug APK (needs Metro at run time, see Status):

```bash
cd app/android
./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a,x86_64     # Windows: gradlew.bat
# output: app/android/app/build/outputs/apk/debug/app-debug.apk
```

Without `-PreactNativeArchitectures`, Gradle builds four ABIs and takes much longer. Install a built APK with `adb install -r app/android/app/build/outputs/apk/debug/app-debug.apk`, then keep `npm start` and the backend running.

### Demo APK that runs without Metro (Android emulator only)

The standard debug APK needs Metro. For a reviewer who only has an emulator, you can embed a development-mode bundle into a debug build. The bundle must be `--dev true`, because the app only uses the emulator backend address `http://10.0.2.2:4000` when `__DEV__` is true. The result is debug-signed, works on an emulator only (that address is the emulator alias for your computer), and still needs the local backend from section 1.

```bash
cd app
mkdir -p android/app/src/main/assets
npx react-native bundle --platform android --dev true --minify false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res
cd android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a,x86_64     # Windows: gradlew.bat
```

The bundle step writes untracked files under `android/app/src/main/assets` and `android/app/src/main/res` (drawable folders and `raw`). Delete them after building and check `git status` before committing. Then start the backend, and install and open the APK with no Metro and no `adb reverse`:

```bash
adb install -r app/android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.nitishrg.todo/.MainActivity
```

### Release builds (not for submission as is)

`assembleRelease` is guarded: it fails unless `PRODUCTION_API_URL` is a public https origin, and it signs only if `TODO_UPLOAD_STORE_FILE`, `TODO_UPLOAD_STORE_PASSWORD`, `TODO_UPLOAD_KEY_ALIAS` and `TODO_UPLOAD_KEY_PASSWORD` are set in your user Gradle properties or environment (never in this repository). Without them the output is **unsigned**. To verify packaging only:

```bash
./gradlew assembleRelease -PallowEmptyApiUrl=true -PreactNativeArchitectures=arm64-v8a,x86_64
# output: app/android/app/build/outputs/apk/release/app-release-unsigned.apk  (cannot be installed or uploaded)
```

## 5. Five-minute acceptance walk-through

Start the backend, Metro and the app as above, then:

1. **Register**: on the sign-in screen choose "New here? Create an account", enter an email and a password of 8 or more characters with a letter and a digit. You land on an empty task list.
2. **Validation**: sign out (Account tab), try signing in with a wrong password and see the error; try registering with `abc` and see the inline message.
3. **Create**: tap `+`, enter a title and description, choose High priority, pick a start date-time and switch on Deadline and pick a later date-time, pick or create a category, tap Add. The card shows priority, category, dates and the deadline.
4. **Complete**: tick the checkbox; progress changes and a snackbar offers Undo.
5. **Edit**: tap the card, change the title or priority, Save.
6. **Sort and filter**: add two or three more tasks (one with a past deadline). Use the header sort button (Smart, Nearest deadline, Newest first) and the Active, Completed, Overdue and category chips.
7. **Delete**: open a card's menu, Delete, confirm.
8. **Persistence**: force-stop the app and open it again: you stay signed in and the tasks are still there. Optional proof from the API side:
   ```bash
   TOKEN=$(curl -s -X POST http://127.0.0.1:4000/auth/login -H 'Content-Type: application/json' -d '{"email":"YOU@example.com","password":"YOURPASSWORD"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).accessToken))")
   curl -s http://127.0.0.1:4000/tasks -H "Authorization: Bearer $TOKEN"
   ```
9. **Isolation**: register a second user: it sees none of the first user's tasks, and requesting the first user's task id returns 404.

## Troubleshooting

- "Can't reach the server": the backend is not running or not reachable from the emulator or phone (section 2). `curl /ready` on the computer first.
- Blank or red screen after install: Metro is not running or `adb reverse tcp:8081 tcp:8081` was not run.
- Gradle fails with a Java error: `JAVA_HOME` must point to JDK 17 or newer.
- Behaviour does not match the code: look for a stale backend or Metro process still holding port 4000 or 8081.
- "Your session expired" right after scripted logins: the server keeps the 5 newest sessions per account, so many `curl` logins for the same user sign the app out. Use another account for scripts.
- Red "Unable to load script" screen: Metro is unreachable. Check `npm start`, rerun `adb reverse tcp:8081 tcp:8081`, then relaunch the app.
- The Android emulator needs a few GB of free RAM; on a starved machine it shows "not responding" dialogs and very slow saves. Close other heavy programs.
- Gradle error "package com.todoapp does not exist" after pulling the identity change: an ignored cache from an older checkout still holds the old package. Delete `app/android/build/generated/autolinking` and `app/android/app/build/generated/autolinking`, then rebuild. A fresh clone is not affected.
- Metro cannot start while Gradle is compiling native code on a slow machine: let Gradle finish first.

## More documentation

- `docs/acceptance.md`: requirement-by-requirement matrix with implementation locations and evidence.
- `docs/ui-states.md`: audit of the ten UI states (empty, loading, error, offline, slow network, no results, permission, session expired, validation, success) with known gaps.
- `docs/requirements.md`: requirement IDs and statuses. `docs/verification.md`: commands, results, limitations. `docs/decisions.md`: design decisions. `docs/design-system.md`: UI tokens. `docs/deployment.md`: what hosting would need.
- `docs/evidence/`: screenshots and API read-backs from emulator runs.
