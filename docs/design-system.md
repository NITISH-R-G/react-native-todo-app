# Design system

Evidence: screenshots + uiautomator dumps in `docs/evidence/reference-apk/` (Android 35 x86_64 emulator, 1080x2400, light theme, "Auto" theme mode, dynamic colour not verified on this emulator).
Labels: OBSERVED = seen in screenshot/dump; INFERRED; UNKNOWN. Colours below were pixel-sampled (SAMPLED) from the screenshots; type scale, dp radii and motion remain UNKNOWN.

## Reference screens (OBSERVED)
| # | Screen | Observed content |
|---|---|---|
| 01-02 | Onboarding (2 pages) | Skip (text button, top right), large rounded-square tonal icon tile with check, headline "Stay on top of tasks", body, pill page indicator (active = elongated), full-width pill "Next" |
| 03 | Home (Tasks tab) | Large bold primary-coloured greeting ("Good night"), two outlined circular icon buttons (Search, Calendar), "Progress" label + % + progress bar, content sheet with large top corner radius, empty state (tonal circle + check, "No tasks yet. Tap + to add one!"), rounded-square FAB, bottom bar with 2 destinations (Tasks, Settings) with pill active indicator and labels |
| 04 | FAB speed-dial | Background blurred; tonal pill buttons "Add Task", "Voice task"; FAB becomes close (x) |
| 08 | New Task | Back (outlined circle) + large title + outlined "Add" button with check; sections with small caps primary labels; outlined Title*/Description fields inside a tonal container; Priority = 3-segment connected button group (High/Medium/Low, selected shows check + tinted colour: Medium = orange); Category = segmented group (General/Study/Shopping, horizontally scrollable); quick-date chips Today/Tomorrow/Next Mon; list rows with icon tile + Due Date / Due Time / Reminder (switch, disabled until time set) / Repeat (switch) |
| 10 | Task list | Group header "Today"; task card with rounded corners, red left edge (High priority), rounded-square checkbox, title, category chip, date chip, overflow menu |
| 11 | Completed | Checkbox checked, title struck through, group "Completed", progress 100% with *wavy* indicator, confetti burst, snackbar "<title> task completed" with Dismiss |
| 12 | Settings | Sections THEME & COLORS (Theme Mode: Auto + Change; Dynamic Color), INTERFACE & LAYOUT (Show Progress; Bottom Navigation Labels; Hide Navigation on Scroll), CATEGORIES (Manage Categories), GESTURES (Pull to Refresh) |
| 13 | Calendar | Back, large title, "Today" outlined button; month header with prev/next; tonal month grid card; selected day = filled rounded rect showing "[done/total]"; list of that day's tasks below |

## Direction for the RN build (decisions, not observations)
- Material 3 colour roles via a tokenised theme (primary, onPrimary, primaryContainer, secondaryContainer, surfaceContainer*, outline, error), light + dark.
- Expressive traits to reproduce: large bold display titles, high-radius sheets/cards, connected button groups, pill nav indicator, wavy progress, tonal FAB, motion on completion.
- Not reproduced from the reference on purpose: self-update, voice task, backup/export, repeat/reminder (no assignment requirement); will be listed under optional if time permits.
- Added beyond the reference because the assignment requires them: Register/Login screens, deadline field, server-backed list.
- UNKNOWN until sampled: exact palette, type scale, radii in dp, motion curves/durations.

## Sampled colours (SAMPLED from reference screenshots, light theme)
primary/FAB/Next button #0061A4 · primaryContainer (icon tile, Today chip) #D1E4FF · background/content sheet #F8F9FF · screen top background #F0F4F8 · bottom bar #E5ECF4 · nav active pill / selected segment (secondaryContainer) #D7E3F7 · task card & form container #E6EEF9 / #E4ECF8 · progress track #DFE2EB · High priority stripe #E53935 · snackbar #322F35 · Medium selected fill #E7DDD0 (label orange).
Implementation: `app/src/design/tokens.ts` marks each value SAMPLED / DERIVED / DECISION. Dark scheme is DERIVED from the same blue tonal palette (not observed in the reference).
