# Decisions

- D1 Assignment over reference: reference APK is native Kotlin/Compose with no auth/backend; assignment mandates RN CLI + backend + auth.
- D2 Backend: Express + Mongoose + zod + argon2id + JWT (15m access, 30d rotating refresh with server-side jti hash). Chosen over Nest for smaller surface and faster delivery; layering (routes / validation / domain / models) is kept so a port is mechanical.
- D3 Tests use mongodb-memory-server (real mongod) - user choice; Docker daemon was not running.
- D4 Past deadlines are accepted on create and reported as derived `overdue`; deadline < startAt is rejected (create and partial update).
- D5 Smart sort: incomplete first; score = priority(10/20/30) + deadline urgency (70/(1+h/24), flat 80 if overdue); ties -> deadline, startAt, createdAt, id. See `backend/src/domain/sort.ts`.
- D6 Malformed or foreign task ids both return 404 to avoid leaking existence.
- D7 Android Gradle will use Android Studio's bundled JDK via JAVA_HOME (system default is Java 1.8).
