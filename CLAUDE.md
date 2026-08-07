# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# Project: OFCS Field Trip Form

Google Apps Script web app (bound to a Google Sheet) that runs the Olmsted Falls City School District field trip request/approval workflow: teacher submits → building admin approves/rejects → district admin approves/rejects → document merge, email notifications, and calendar entry.

## Critical: which files are actually live

This repo went through an in-place rewrite. The original pre-rewrite files (`Code.js`, `forms.html`, `buildAdmin.html`, `districtAdmin.html`) and an unused scratch template (`FormTest.html`) have been deleted — they were fully superseded, kept no unique behavior, and were only ever excluded from `clasp push` via `.claspignore` (also cleaned up accordingly). Everything in the repo root now **is** pushed via `clasp push` and is live:

| Active file | Role |
|---|---|
| `CodeNew.js` | `doGet` router — main form / building admin / district admin / legacy quick-reject dispatch. Also holds `getSettings()`, `JSONCacheService()`, the legacy `update()` shim. |
| `Config.js` | `FORM_SCHEMA` — single source of truth for form fields, column headers, validation flags. Add/rename a field here first. |
| `DataLayer.js` | Sheet I/O: column-header-based mapping (`getColumnMapping`), `appendSubmission`, `findSubmission`, `updateSubmission` (all operate on the single `Submissions` sheet - see Data model), plus `normalizeTripDateString`/`isArchivedTripDate` (the Current-vs-Archives cutover check shared with `LegacyImport.js`). Uses `LockService` on append to avoid concurrent-submission collisions. |
| `ValidationUtils.js` | `sanitizeInput`/`sanitizeFormData` (XSS-safe), `validateFormData` against `FORM_SCHEMA`, cross-field time-sequence checks. |
| `FormHandlers.js` | Entry points called from the HTML via `google.script.run`: `submitFieldTripForm`, `approveBuildingAdmin`, `approveDistrictAdmin`, `getSubmissionData`. |
| `EmailService.js` | All HTML email bodies (submission, approval, rejection notifications). |
| `Merge.js` / `PreMerge.js` | Google Doc template merge — `doMerge` (final approved doc) / `doPreMerge` (initial submission receipt). Placeholder syntax: `[Column_Header]` in the template doc, matched against sheet header row. |
| `CalendarAdd.js` | `addToCalendar` — adds the trip to a named Calendar. |
| `DigestService.js` | `sendDailyDigests` — for buildings set to digest mode, emails one daily rollup of pending building-approval trips instead of per-submission emails. `createDailyDigestTrigger` is a one-time setup function (run manually from the Apps Script editor, not pushable via clasp) that installs the time-based trigger. |
| `LegacyImport.js` | Two one-time migration tools, run manually from the Apps Script editor, not wired into the dashboard: `migrateToArchiveModel` splits whatever's already in this app's own `Submissions`/`Completed` sheets into `Submissions`/`Archives` by `trip_date` (retires the old `Completed` sheet, leaving it unwritten as a backup); `importLegacyTrips` backfills historical trips from the old pre-rewrite app's own spreadsheet (hardcoded `LEGACY_SPREADSHEET_ID`), same `trip_date`-based routing. Both default to a dry run; pass `false` to actually write. |
| `AdminAuth.js` | `_Admins` roster lookup (`getAdminContext`, `getDashboardContext`) and the `canActOnBuildingStage`/`canActOnDistrictStage` authorization guards used by every dashboard RPC. |
| `AdminDashboardHandlers.js` | Dashboard RPCs for the Pending/History tabs: `getPendingForMe`, `getHistory`, `bulkProcessSubmissions`, `adminCreateSubmission`, `adminEditSubmission`, `adminPrintSubmission`. |
| `SettingsHandlers.js` | Dashboard RPCs for the Settings tab: `getSettingsForDashboard`/`saveSettings` (`_Settings` sheet, whitelisted keys only, including the per-building `<CODE>_NOTIFY_MODE` super-admin-only digest toggle) and `getAdminsRosterForDashboard`/`addAdminRow`/`setAdminRowActive` (`_Admins` roster). |
| `FormNew.html`, `BuildingAdminNew.html`, `DistrictAdminNew.html`, `DoneAlready.html` | Bootstrap 5 frontends (dark blue / pink / blue themed respectively). |
| `AdminDashboardNew.html` | The Admin/Super-Admin Dashboard — Pending, History, and Settings tabs, role-adaptive from a single page. Routed at `?dashboard=1`. |
| `NotAuthorized.html` | Shown at `?dashboard=1` to a signed-in visitor with no `_Admins` row. |

When asked to "update the form" or "fix the admin page," edit the `*New.html` / `*New.js` files, not the legacy ones, unless told otherwise.

## Known inconsistencies (do not silently "fix" — confirm with user first)

- ~~`CalendarAdd.js`'s `addToCalendar(data3, name, docURL)` expected the old flat field names/3-arg signature~~ — resolved: `addToCalendar(data, calendarName, docURL)` now takes the submission `dataObject` (current `FORM_SCHEMA` keys) plus the calendar name, and parses `trip_date`/`leave_school`/`arrive_school` (which may arrive as a Date or a "YYYY-MM-DD" string, and are stored as 12-hour "h:mm AM/PM" strings) via a local `parseTripDateTime` helper.
- ~~`FormHandlers.js` gated the calendar branch on `settings.CALENDAR_ID`, but `_Settings` only has `CALENDAR_NAME`~~ — resolved: the district-approval flow now checks `settings.CALENDAR_NAME` and passes it through to `addToCalendar`.
- ~~`EmailService.js`'s `sendBusGarageNotification` reads `settings.BUS_GARAGE_EMAIL`~~ — resolved: `FINAL_EMAIL` *is* the bus garage address (confirmed with user); `BUS_GARAGE_EMAIL` was never a real `_Settings` key. `EmailService.js` and `FormHandlers.js` now read `settings.FINAL_EMAIL`.

## Data model

- `Config.js`'s `FORM_SCHEMA` object is the single source of truth: field key → `{ type, columnHeader, required, label, ... }`. Sheet columns are matched **by header text**, not position, so column reordering in the sheet is safe.
- Status workflow lives in `STATUS_VALUES` (`Config.js`): `Pending Building Approval` → `Pending District Approval` → `Approved`/`Rejected`. All four statuses live in the **same** `Submissions` sheet — there is no separate `Completed` sheet anymore (see below), so `findSubmission`/`updateSubmission` (`DataLayer.js`) always operate on `Submissions` and take no sheet-name parameter.
- **Current vs. Archives, split by trip_date (not by status):** `Submissions` holds every trip the app itself has ever handled — pending, approved, and rejected alike, forever — but *only* trips whose `trip_date` is on/after `Config.js`'s `ARCHIVE_CUTOFF_DATE` (currently `2026-06-01`, when the rewrite went live). Anything with an earlier `trip_date` lives in a separate `Archives` sheet instead — same `FORM_SCHEMA` columns, browsed in the dashboard's History tab via a year picker (`getHistory`'s `scope: 'archive'`). This is a **one-time cutover, not a rolling window**: nothing currently sweeps old "current" trips into Archives as years pass — if that's ever wanted, it'd be a new manual maintenance function alongside `LegacyImport.js`'s tools, not something that runs automatically today.
- A `Completed` sheet may still physically exist in the spreadsheet as a pre-migration artifact — `LegacyImport.js`'s `migrateToArchiveModel()` is the one-time function that reads whatever's in it, routes each row into `Submissions` or `Archives` by `trip_date`, and leaves `Completed` itself untouched (delete/rename it manually once you've checked the result). No other code reads or writes `Completed`.
- Runtime config (admin emails per building, template/folder IDs, calendar name) lives in the `_Settings` sheet, loaded via `getSettings()` (`CodeNew.js`). `CACHE_SETTINGS` is `true` — reads are cached for `SETTINGS_CACHE_TTL` (900s) via `JSONCacheService`. The only writer is `SettingsHandlers.js`'s `saveSettings()`, which calls `cache.remove('_settings')` after every write — **any new code path that writes to `_Settings` directly (bypassing `saveSettings`) must also invalidate that cache key**, or callers will keep seeing the pre-write value for up to 15 minutes.
- `_Admins` sheet is the dashboard's access-control roster — separate from `_Settings`, not merged into it (merging would mean rewriting `FormHandlers.js`'s existing per-building email lookup, a real behavior-change risk for no gain). Columns: `Email`, `Role` (`building`/`district`/`super`), `Building` (only meaningful for `role=building`), `Name`, `Active`. One row per (person, role-at-a-building) grant — someone covering two buildings, or holding two roles, gets two rows. Looked up via `AdminAuth.js`'s `getAdminContext(email)`.

## Admin Dashboard (`?dashboard=1`)

- Identity comes from `Session.getActiveUser().getEmail()` — no separate login. This only works because the web app is deployed for "Anyone within domain," so the visitor is already Google-authenticated by the time `doGet` runs.
- `doGet` (`CodeNew.js`) looks up the visitor in `_Admins` and serves `AdminDashboardNew.html` (role embedded server-side as `ctx`) or `NotAuthorized.html`. But **the real authorization boundary is the RPC layer, not this routing check** — every function in `AdminDashboardHandlers.js`/`SettingsHandlers.js` independently calls `getDashboardContext()` and re-derives permissions from the sheet, since a client-supplied building/role/status can't be trusted.
- Role rules: a plain `building` admin only sees/acts on their own building's building-stage rows; `district` (and `super`, which always implies `district`) can act on any building's district-stage rows; only `super` can act on building-stage rows outside their own building, create/edit/print trips directly, or manage the full `_Admins` roster. A plain building admin can *add* an admin to their own building but can't edit or deactivate an existing grant (`setAdminRowActive` requires `isSuper||isDistrict`).
- Bulk approve/reject (`bulkProcessSubmissions`) delegates each row to the existing single-item `approveBuildingAdmin`/`approveDistrictAdmin` rather than duplicating their email/doc-merge/calendar side effects — capped at 20 rows per call (tunable, not a hard requirement) since `doMerge` per row is the expensive step against Apps Script's 6-minute execution limit.
- ~~The emailed-link approval pages were intentionally unauthenticated~~ — resolved: `doGet`'s `buildingReview`/`districtReview` branches now call `getAdminContext()` and the same `canActOnBuildingStage`/`canActOnDistrictStage` guards the dashboard RPCs use, so opening the link only works if the visitor is actually an authorized admin for that submission's stage; anyone else gets `NotAuthorized.html`.

## Environments (dev vs prod) — be careful here

- Two separate Apps Script projects, switched via `.clasp.json` (git-ignored): `.clasp.dev.json` / `.clasp.prod.json`, swapped with `./switch-env.sh dev|prod`.
- Git branches: `dev` (day-to-day work) → `master` (production).
- **Always run `./switch-env.sh` with no args to check the current target before `clasp push`.** Pushing to prod is a live-app change affecting real district staff — confirm with the user before pushing to prod or merging `dev` → `master`.
- `clasp push` only pushes files not excluded by `.claspignore` (see table above).

## Conventions

- Code is ES5-style (`var`, no arrow functions, no `let`/`const`) — this is Apps Script's V8 runtime but the existing style predates it; match it in new code.
- Server functions return plain objects (`{ success, message, ... }`) to the frontend via `google.script.run`, not thrown errors — frontend checks `.success`.
- Times are stored as formatted 12-hour strings (`formatTimeTo12Hour`) and written with `setNumberFormat('@')` to stop Sheets from re-interpreting them as datetimes.
- Submission numbers are `+new Date()` (millisecond timestamp), not sequential — used as the row lookup key everywhere (`findSubmission`).
