# Decisions

- D1 Assignment over reference: reference APK is native Kotlin/Compose with no auth/backend; assignment mandates RN CLI + backend + auth.
- D2 Backend: Express + Mongoose + zod + argon2id + JWT (15m access, 30d rotating refresh with server-side jti hash). Chosen over Nest for smaller surface and faster delivery; layering (routes / validation / domain / models) is kept so a port is mechanical.
- D3 Tests use mongodb-memory-server (real mongod) - user choice; Docker daemon was not running.
- D4 Past deadlines are accepted on create and reported as derived `overdue`; deadline < startAt is rejected (create and partial update).
- D5 Smart sort: incomplete first; score = priority(10/20/30) + deadline urgency (70/(1+h/24), flat 80 if overdue); ties -> deadline, startAt, createdAt, id. See `backend/src/domain/sort.ts`.
- D6 Malformed or foreign task ids both return 404 to avoid leaking existence.
- D7 Android Gradle will use Android Studio's bundled JDK via JAVA_HOME (system default is Java 1.8).
- D8 UI deps (all JS or autolinked): react-native-paper (Material 3 components/theme tokens; checked: no official Expressive components, so Expressive traits are custom, labelled in tokens.ts), @react-navigation/native + native-stack + react-native-screens (standard navigation; auth gate swaps navigator trees), react-native-keychain (Keystore-backed token storage, not AsyncStorage), @react-native-community/datetimepicker (native Material date/time dialogs), zustand (small typed stores for auth/tasks; Redux judged heavier than needed), @react-native-vector-icons/material-design-icons (Paper's icon source), @testing-library/react-native (component tests).
- D9 Server is the source of truth in the app: every task mutation is followed by GET /tasks; no optimistic updates.
- D10 Dev vs prod API: debug uses http://10.0.2.2:4000; release uses PRODUCTION_API_URL, intentionally empty and required to be https, so a release cannot ship a dev URL.
- D11 Progress indicator is a thick animated bar; wavy indicator and confetti deferred (extra native dependency for decoration).
- D12 Local dev API: `backend npm run dev:local` runs a real persistent mongod (mongodb-memory-server with dbPath) and generates JWT secrets into gitignored `.devdata/`; auth rate limit raised there via AUTH_RATE_LIMIT_MAX (default 20 in production config).
