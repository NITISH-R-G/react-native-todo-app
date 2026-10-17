# UI state inventory (Sprint 5)

The ten states below were audited against the code (`app/src`) and, where marked, observed on the emulator. This is an audit, not a redesign: nothing here adds a feature. Gaps are listed as decisions for the owner.

Evidence kinds: **Device** = seen on the emulator, **Jest** = covered by an automated test, **Code** = read in source only.

| # | State | What the app does | Where | Evidence | Status |
|---|---|---|---|---|---|
| 1 | Empty | Illustration plus "No tasks yet. Tap + to add one!" and the + button | `screens/TasksList.tsx` | Device: `evidence/app-sprint5/02-empty-state.png`; Jest | VERIFIED |
| 2 | Loading | Full-screen spinner with the live-region label "Loading tasks"; buttons show an inline spinner while saving or deleting and are disabled | `TasksList.tsx`, `TaskFormScreen.tsx`, `AuthForm.tsx` | Jest. On the emulator a save spinner stayed up for tens of seconds on a memory-starved host and then completed | PARTIALLY VERIFIED (code and Jest; spinner seen on device only incidentally) |
| 3 | Error | Full-screen message with "Try again" when the first load fails; a banner with Retry when a refresh fails and tasks are already shown; per-action snackbars | `TasksList.tsx`, `ui/ErrorBanner.tsx`, `api/errors.ts` | Jest; earlier sprint emulator runs (5xx, offline). Not re-run this sprint | PARTIALLY VERIFIED |
| 4 | No internet | A network failure maps to "Can't reach the server. Check your connection and try again." and offers retry. At launch while offline the session is kept and the list shows its retry state. There is no dedicated offline page and no connectivity listener; creating or editing offline is not supported | `api/errors.ts`, `state/authStore.ts` | Jest; earlier sprint emulator run. Not re-run this sprint | PARTIALLY VERIFIED |
| 5 | Slow network | Each request aborts after 15 seconds and then shows the error state. Between 0 and 15 seconds only the normal spinner shows; there is no "taking longer than usual" message | `api/client.ts` (`TIMEOUT_MS`) | Code; Jest for the timeout error | PARTIALLY VERIFIED (gap: no intermediate slow state) |
| 6 | No search results | There is no search feature. The equivalent is "No tasks match your filters." with a Clear filters button | `TasksList.tsx` | Jest; Device: filter combinations returned only matching tasks in Sprint 4 | VERIFIED for filters; search itself does not exist |
| 7 | Permission denied | The app asks for no runtime permissions (the release manifest declares INTERNET only). Server-side ownership failures answer 404 and the list simply does not show other users' tasks. The only 403 is a wrong password on account deletion, shown inline in the dialog. There is no standalone "permission denied" screen | `AndroidManifest.xml`, `DeleteAccountDialog.tsx` | Jest; API: other user's task gives 404 (`evidence/app-sprint4/server-isolation-and-errors.txt`) | NOT APPLICABLE as a screen; inline 403 VERIFIED |
| 8 | Session expired | The sign-in screen shows "Your session expired. Please sign in again." when a refresh fails. The server keeps the 5 newest sessions per user, so a sixth sign-in on the same account signs the oldest device out | `state/authStore.ts`, `api/client.ts` | Device: `evidence/app-sprint5/01-session-expired.png` and `08-session-evicted-by-test-logins.png`; Jest | VERIFIED |
| 9 | Form validation | Inline helper text under the field with an error colour, a live region for screen readers, and the submit blocked until valid: email format, password rule (8 or more characters with a letter and a digit), required title, deadline not before start | `ui/AuthForm.tsx`, `TaskFormScreen.tsx`, `domain/validation.ts` | Jest; Device in earlier sprints | VERIFIED |
| 10 | Success | Completing a task shows a snackbar with Undo and updates the progress bar; creating or editing returns to the list where the change is visible; deleting asks for confirmation and removes the card. There is no separate success toast for create, edit or delete | `screens/HomeScreen.tsx`, `TasksList.tsx` | Device: Sprint 4 and `evidence/app-sprint5/06-completed.png`, `07-after-edit-and-complete.png` | PARTIALLY VERIFIED |

## Gaps that need an owner decision (not implemented, to respect "no optional features")

1. Slow network: add a "This is taking longer than usual" hint after a few seconds, before the 15 second timeout.
2. No internet: add a dedicated offline banner or page driven by a connectivity listener (needs a new dependency), or accept the current retry-on-failure behaviour.
3. Success feedback: add a short confirmation snackbar after create, edit and delete, or accept the visible list change as feedback.
4. Search: not built; the filters cover the assignment's "filtering" wording.

## Not verified

TalkBack speech for these states, a physical device, and re-running the offline, 5xx and double-submit device scenarios in this sprint.
