# Deployment readiness

Status: NOT DEPLOYED. No hosting, database, domain or URL exists. Nothing here proves hosted behaviour; it lists what the code supports, what was verified locally, and what needs your decisions.

## What the backend supports (verified locally, see verification.md B7)
| Capability | How | Verified |
|---|---|---|
| Config from environment only | `backend/.env.example` lists every variable | unit tests refuse unsafe combinations |
| Startup fails fast and safely | MongoDB failure exits non-zero with a credential-free message | test, `lifecycle.test.ts` |
| Indexes before traffic | unique email and task indexes created at startup | test |
| Liveness and readiness | `GET /health` (process up), `GET /ready` (MongoDB answers; 503 otherwise) | test, including database loss |
| Graceful shutdown | `SIGTERM`/`SIGINT` stop accepting, drain, close MongoDB, then exit | `close()` tested; real signal handling NOT tested (the dev machine is Windows, where Node cannot receive a graceful SIGTERM) |
| Proxy awareness | `TRUST_PROXY` hop count; per-client rate limits | tests |
| HTTPS enforcement | `REQUIRE_HTTPS=true` refuses plain HTTP except health checks | test with forwarded protocol header |
| Rate limits | auth: 20 per 15 min per client IP; task API: 300 per minute per user | tests |
| Compiled production run | `npm run build` then `node dist/server.js` | `scripts/smoke-prod.mjs` against a real mongod: 8 checks passed |
| Container image | `backend/Dockerfile`, `.dockerignore` | NOT VERIFIED (Docker daemon not running) |

## Decisions and resources needed from you (nothing below was created)
1. Hosting platform for the API (any host that runs a Node 24 process or a container and terminates TLS).
2. MongoDB: hosted cluster (for example Atlas) with a dedicated database user limited to the app database, network access restricted to the API host, automated backups and a retention period.
3. Public API hostname and TLS certificate (usually provided by the host).
4. Two new random secrets of at least 32 characters for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`, stored in the host's secret store (generate on your machine; do not paste them into chat or commit them).
5. `TRUST_PROXY` value for your platform (normally 1) and `REQUIRE_HTTPS=true`.
6. Where logs go and who gets alerted. The app writes JSON request lines (with `LOG_REQUESTS=true`) and error lines to stdout; collection and alerting are platform features.

## Checklist before first deploy
- [ ] Platform health check on `/health`, readiness or routing check on `/ready`.
- [ ] Secrets set; `.env` not baked into any image.
- [ ] `TRUST_PROXY=1`, `REQUIRE_HTTPS=true`, `CORS_ORIGINS` empty (native app only).
- [ ] Build the image once (`docker build`) or confirm the platform build runs `npm ci && npm run build`.
- [ ] After deploy, run the smoke flow against the real URL: register, login, create, list, delete (and confirm a request over plain HTTP gets 426).
- [ ] Confirm the first start created indexes (a duplicate-email registration returns 409).
- [ ] Enable database backups and perform one test restore into a scratch database.
- [ ] Set `PRODUCTION_API_URL` in `app/src/config/productionApiUrl.ts` to the real https origin, then build the release.

## Data and privacy facts for the Play listing (from the code)
- Collected: email address, password (stored only as an argon2id hash), tasks the user creates (title, description, dates, priority, category).
- Not collected: location, contacts, device identifiers, analytics, advertising IDs.
- Sent over the network: all data goes only to the configured API.
- Account deletion: the in-app path IS implemented and verified (`DELETE /auth/account` with the account password; Account tab, "Delete account"; see requirements PRIV-001, which lists backend tests, Jest tests and a device run with server read-back). It removes the user, all tasks and all sessions. Still missing and still a store requirement: a public web page where a user can request account and data deletion without the app installed (Google Play asks for this link in the Data safety form), and a public privacy policy URL. Neither exists yet. Apple also requires the in-app path (present) and a privacy policy URL.
- Retention and backup policy: to be decided by you and stated in the privacy policy.
