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
| `CodeNew.js` | `doGet` router — main form / building admin / district admin dispatch, each gated by `getAdminContext()` for the review-link routes. Also holds `getSettings()`, `JSONCacheService()`, and `getAppSpreadsheet()` — every sheet access in the codebase goes through this instead of calling `SpreadsheetApp.getActiveSpreadsheet()` directly, so a project can be pointed at a different spreadsheet via its own Script Properties (`APP_SPREADSHEET_ID`) without losing its container binding or web app URL — see "Flipping the switch to production". (The old unauthenticated `?action=reject` quick-reject route and the legacy `update()` shim were removed — both were dead, unauthenticated code paths.) |
| `Config.js` | `FORM_SCHEMA` — single source of truth for form fields, column headers, validation flags. Add/rename a field here first. |
| `DataLayer.js` | Sheet I/O: column-header-based mapping (`getColumnMapping`), `appendSubmission`, `findSubmission`, `updateSubmission` (all operate on the single `Submissions` sheet - see Data model), plus `normalizeTripDateString`/`isArchivedTripDate` (the Current-vs-Archives cutover check shared with `LegacyImport.js`). Uses `LockService` on append to avoid concurrent-submission collisions. |
| `ValidationUtils.js` | `sanitizeInput`/`sanitizeFormData` (XSS-safe), `validateFormData` against `FORM_SCHEMA`, cross-field time-sequence checks, and a destination-matches-departure-school check that compares just street number + first word of street name (`extractStreetKey`) rather than requiring an exact string match, so "123 Main St" vs "123 Main Street, Springfield, OH 44017" still catches the mistake; falls back to a full normalized-string comparison if either address doesn't start with a number. |
| `FormHandlers.js` | Entry points called from the HTML via `google.script.run`: `submitFieldTripForm`, `approveBuildingAdmin`, `approveDistrictAdmin` (both lock the check-then-act status transition via `LockService` to prevent double-processing), `getMySubmissions` (teacher-facing email lookup, `Submissions` only — doesn't search `Archives`). Both approval functions skip the per-submission admin email when that stage's `_NOTIFY_MODE` is `digest` (building via `<CODE>_NOTIFY_MODE`, district via `DISTRICT_NOTIFY_MODE` — see `DigestService.js`). |
| `EmailService.js` | All HTML email bodies (submission, approval, rejection notifications). `sendBuildingAdminNotification`/`sendDistrictAdminNotification` route admins to the dashboard (`?dashboard=1`) rather than a direct single-submission review link — the old link's URL is still computed and its button markup left in place but commented out, so restoring it is a one-line uncomment if ever wanted back. |
| `TripDocument.js` | `buildTripSummaryDoc` — the single, code-generated "Field Trip Application" Google Doc layout (no static template file involved), covering every current `FORM_SCHEMA` field. Re-reads the submission fresh from the sheet each time it's called, so an Approval section (building/district reviewer, date, comments) automatically appears once those fields have values, and stays absent for a still-pending trip. |
| `Merge.js` / `PreMerge.js` | Thin wrappers around `TripDocument.js`'s `buildTripSummaryDoc` — `doMerge` (called at final district approval, and by the dashboard's Print button) / `doPreMerge` (called right at submission, for the confirmation-email attachment). Kept as separate named functions/files since each is a distinct step in the workflow, not because they produce different documents — they don't; **as of 2026-08-15 these no longer merge into a Drive-hosted template Doc** (the old `TEMPLATE_ID`/`TEMPLATE_INIT_ID` `_Settings` keys are unused/removed) because that template silently went stale as fields were added over time with no one updating it — see git history around that date for the before/after. Every call also writes the resulting URL to `approval_doc_url` (`Approval_Document_URL` column) — that field now means "latest generated doc for this trip," not narrowly "the final approval doc" (kept the existing column/header name rather than renaming a live sheet header across dev+prod). |
| `CalendarAdd.js` | `addToCalendar` — adds the trip to a named Calendar. |
| `DigestService.js` | `sendDailyDigests` — for buildings (and, mirroring buildings, the district admin) set to digest mode, emails one daily rollup of pending trips instead of per-submission emails (`sendBuildingDigestEmail` per building; `sendDistrictDigestEmail` district-wide, with an added Building column since it spans every building). `createDailyDigestTrigger` is a one-time setup function (run manually from the Apps Script editor, not pushable via clasp) that installs the time-based trigger. |
| `LegacyImport.js` | Two one-time migration tools, run manually from the Apps Script editor, not wired into the dashboard: `migrateToArchiveModel` splits whatever's already in this app's own `Submissions`/`Completed` sheets into `Submissions`/`Archives` by `trip_date` (retires the old `Completed` sheet, leaving it unwritten as a backup); `importLegacyTrips` backfills historical trips from the old pre-rewrite app's own spreadsheet (hardcoded `LEGACY_SPREADSHEET_ID`), same `trip_date`-based routing. Both default to a dry run; pass `false` to actually write. |
| `AdminAuth.js` | `_Admins` roster lookup (`getAdminContext`, `getDashboardContext`) and the `canActOnBuildingStage`/`canActOnDistrictStage` authorization guards used by every dashboard RPC. |
| `AdminDashboardHandlers.js` | Dashboard RPCs for the Pending/History tabs: `getPendingForMe`, `getHistory`, `bulkProcessSubmissions`, `adminCreateSubmission`, `adminEditSubmission` (still super-admin-only server-side), `adminPrintSubmission`. |
| `SettingsHandlers.js` | Dashboard RPCs for the Settings tab: `getSettingsForDashboard`/`saveSettings` (`_Settings` sheet, whitelisted keys only) and `getAdminsRosterForDashboard`/`addAdminRow`/`setAdminRowActive` (`_Admins` roster). Notification mode (`instant`/`digest`) is super-admin-only regardless of scope: per-building via `<CODE>_NOTIFY_MODE`, and the district admin's own via `DISTRICT_NOTIFY_MODE` (mirrors the building toggle, just not building-scoped — see `DISTRICT_NOTIFY_SCOPE` in `saveSettings`). `DISTRICT_ADMIN` (name) sits alongside `DISTRICT_EMAIL` as a plain global setting, editable by district/super like any other global key. |
| `LunchHandlers.js` | RPCs for the teacher-facing lunch-count entry page and the kitchen-facing Lunch Dashboard — see "Lunch Dashboard" below. Deliberately its own file, separate from `AdminDashboardHandlers.js`/`SettingsHandlers.js`, so lunch permissions never entangle with trip-approval permissions. `submitLunchCounts`, `getLunchDashboardData`, `getLunchSettingsForDashboard`/`saveLunchSettings` (own `LUNCH_OPTIONS`/`LUNCH_CENTRAL_EMAIL`/`<CODE>_LUNCH_EMAIL` `_Settings` keys). `parseLunchOptions` parses `LUNCH_OPTIONS` as one `Short Name|Description` pair per line — the description is helper text only, never part of the `lunch_names` data key. All four RPCs return `JSON.stringify()`'d strings, not raw objects — see Conventions. |
| `FormNew.html`, `BuildingAdminNew.html`, `DistrictAdminNew.html`, `DoneAlready.html` | Bootstrap 5 frontends (dark blue / pink / blue themed respectively). |
| `AdminDashboardNew.html` | The Admin/Super-Admin Dashboard — Pending, History, and Settings tabs, role-adaptive from a single page. Routed at `?dashboard=1`. A "Refresh" button (Pending and History tabs) re-fetches from the server. Clicking a row's "View" button, or the row itself, opens the trip modal read-only (all fields disabled, no Save) for any admin role; only a super admin sees an in-modal "Edit" button to unlock the fields — deliberate friction, since editing an already-submitted application should be rare. `adminEditSubmission`/`adminPrintSubmission`/`adminCreateSubmission`/delete stay super-admin-only, enforced server-side regardless of what the client shows. The trip modal shows `school_lunch`/`lunch_names`/`lunch_status` read-only when a trip requested lunch, but has no lunch-settings tab of its own — that lives entirely on the separate Lunch Dashboard below. |
| `LunchEntryNew.html` | Teacher-facing, after-the-fact lunch-count entry page (`?action=lunchEntry&idNum=...`), reached via the confirmation email link or the `?checkStatus=1` fallback page — not the admin dashboard. Gated in `doGet` (`CodeNew.js`) by a plain email-identity match against the submission, not an admin-role check. Shows each lunch option's short name plus its description as helper text (what's in the meal, for telling students) — the description is display-only, never part of the saved `lunch_names` blob. |
| `LunchDashboardNew.html` | The kitchen-facing Lunch Dashboard — see "Lunch Dashboard" below. |
| `NotAuthorized.html` | Shown at `?dashboard=1`/`?lunchDashboard=1` to a signed-in visitor with no matching `_Admins` row. |

When asked to "update the form" or "fix the admin page," edit the `*New.html` / `*New.js` files, not the legacy ones, unless told otherwise.

## Known inconsistencies (do not silently "fix" — confirm with user first)

- ~~`CalendarAdd.js`'s `addToCalendar(data3, name, docURL)` expected the old flat field names/3-arg signature~~ — resolved: `addToCalendar(data, calendarName, docURL)` now takes the submission `dataObject` (current `FORM_SCHEMA` keys) plus the calendar name, and parses `trip_date`/`leave_school`/`arrive_school` (which may arrive as a Date or a "YYYY-MM-DD" string, and are stored as 12-hour "h:mm AM/PM" strings) via a local `parseTripDateTime` helper.
- ~~`FormHandlers.js` gated the calendar branch on `settings.CALENDAR_ID`, but `_Settings` only has `CALENDAR_NAME`~~ — resolved: the district-approval flow now checks `settings.CALENDAR_NAME` and passes it through to `addToCalendar`.
- ~~`EmailService.js`'s `sendBusGarageNotification` reads `settings.BUS_GARAGE_EMAIL`~~ — resolved: `FINAL_EMAIL` *is* the bus garage address (confirmed with user); `BUS_GARAGE_EMAIL` was never a real `_Settings` key. `EmailService.js` and `FormHandlers.js` now read `settings.FINAL_EMAIL`.
- ~~The legacy prod project's `appsscript.json` had `webapp.access: ANYONE_ANONYMOUS`, but this codebase's admin auth (`Session.getActiveUser().getEmail()` in `AdminAuth.js`) needs a signed-in, domain-authenticated visitor to work at all~~ — resolved during the production flip: pushed with `access: DOMAIN` (confirmed intentional with user — tightens the live app to signed-in `@ofcs.net` accounts only, whereas the legacy app was reachable anonymously).

## Data model

- `Config.js`'s `FORM_SCHEMA` object is the single source of truth: field key → `{ type, columnHeader, required, label, ... }`. Sheet columns are matched **by header text**, not position, so column reordering in the sheet is safe.
- Status workflow lives in `STATUS_VALUES` (`Config.js`): `Pending Building Approval` → `Pending District Approval` → `Approved`/`Rejected`. All four statuses live in the **same** `Submissions` sheet — there is no separate `Completed` sheet anymore (see below), so `findSubmission`/`updateSubmission` (`DataLayer.js`) always operate on `Submissions` and take no sheet-name parameter.
- **Current vs. Archives, split by trip_date (not by status):** `Submissions` holds every trip the app itself has ever handled — pending, approved, and rejected alike, forever — but *only* trips whose `trip_date` is on/after `Config.js`'s `ARCHIVE_CUTOFF_DATE` (currently `2026-06-01`, when the rewrite went live). Anything with an earlier `trip_date` lives in a separate `Archives` sheet instead — same `FORM_SCHEMA` columns, browsed in the dashboard's History tab via a year picker (`getHistory`'s `scope: 'archive'`). This is a **one-time cutover, not a rolling window**: nothing currently sweeps old "current" trips into Archives as years pass — if that's ever wanted, it'd be a new manual maintenance function alongside `LegacyImport.js`'s tools, not something that runs automatically today.
- A `Completed` sheet may still physically exist in the spreadsheet as a pre-migration artifact — `LegacyImport.js`'s `migrateToArchiveModel()` is the one-time function that reads whatever's in it, routes each row into `Submissions` or `Archives` by `trip_date`, and leaves `Completed` itself untouched (delete/rename it manually once you've checked the result). No other code reads or writes `Completed`.
- Runtime config (admin emails per building, template/folder IDs, calendar name) lives in the `_Settings` sheet, loaded via `getSettings()` (`CodeNew.js`). `CACHE_SETTINGS` is `true` — reads are cached for `SETTINGS_CACHE_TTL` (900s) via `JSONCacheService`. The only writer is `SettingsHandlers.js`'s `saveSettings()`, which calls `cache.remove('_settings')` after every write — **any new code path that writes to `_Settings` directly (bypassing `saveSettings`) must also invalidate that cache key**, or callers will keep seeing the pre-write value for up to 15 minutes.
- `_Admins` sheet is the dashboard's access-control roster — separate from `_Settings`, not merged into it (merging would mean rewriting `FormHandlers.js`'s existing per-building email lookup, a real behavior-change risk for no gain). Columns: `Email`, `Role` (`building`/`district`/`super`/`lunch`/`lunch_district`), `Building` (only meaningful for `role=building`/`lunch`), `Name`, `Active`. One row per (person, role-at-a-building) grant — someone covering two buildings, or holding two roles, gets two rows. Looked up via `AdminAuth.js`'s `getAdminContext(email)`. `lunch`/`lunch_district` are deliberately isolated from `isAdmin` — see "Lunch Dashboard" below.
- Lunch-count entry status lives on the same `Submissions`/`Archives` row but is tracked independently of a trip's own `status`, via `lunch_status` (`Config.js`'s `LUNCH_STATUS_VALUES`: `Awaiting Counts`/`Counts Provided`/`Cancelled`), plus `lunch_counts_entered_date`/`lunch_reminder_sent_date` — all `systemGenerated` fields, set only when `school_lunch` is `Yes`. See "Lunch Dashboard" below.

## Admin Dashboard (`?dashboard=1`)

- Identity comes from `Session.getActiveUser().getEmail()` — no separate login. This only works because the web app is deployed for "Anyone within domain," so the visitor is already Google-authenticated by the time `doGet` runs.
- `doGet` (`CodeNew.js`) looks up the visitor in `_Admins` and serves `AdminDashboardNew.html` (role embedded server-side as `ctx`) or `NotAuthorized.html`. But **the real authorization boundary is the RPC layer, not this routing check** — every function in `AdminDashboardHandlers.js`/`SettingsHandlers.js` independently calls `getDashboardContext()` and re-derives permissions from the sheet, since a client-supplied building/role/status can't be trusted.
- Role rules: a plain `building` admin only sees/acts on their own building's building-stage rows; `district` (and `super`, which always implies `district`) can act on any building's district-stage rows; only `super` can act on building-stage rows outside their own building, create/edit/print trips directly, or manage the full `_Admins` roster. A plain building admin can *add* an admin to their own building but can't edit or deactivate an existing grant (`setAdminRowActive` requires `isSuper||isDistrict`).
- Bulk approve/reject (`bulkProcessSubmissions`) delegates each row to the existing single-item `approveBuildingAdmin`/`approveDistrictAdmin` rather than duplicating their email/doc-merge/calendar side effects — capped at 20 rows per call (tunable, not a hard requirement) since `doMerge` per row is the expensive step against Apps Script's 6-minute execution limit. This also means the dashboard's inline Approve/Reject buttons (single-row or bulk) go through the exact same function chain as the emailed review-link flow below — same status transition, same emails, same doc merge/calendar.
- ~~The emailed-link approval pages were intentionally unauthenticated~~ — resolved: `doGet`'s `buildingReview`/`districtReview` branches now call `getAdminContext()` and the same `canActOnBuildingStage`/`canActOnDistrictStage` guards the dashboard RPCs use, so opening the link only works if the visitor is actually an authorized admin for that submission's stage; anyone else gets `NotAuthorized.html`.

## Lunch Dashboard (`?lunchDashboard=1`)

**Status: built and pushed to `dev` only, as of 2026-08-12 — not yet in production.** Do not push this feature to prod or redeploy prod on its account without the user's explicit go-ahead; they intend to click through the full workflow on dev themselves first (submit a trip, enter counts via the emailed link, check the dashboard as each role) and decide from there. Update this line once that's actually happened.

This is the second design, not the first — dev testing of an earlier version (a Yes/No toggle plus a name-entry modal filled in at submission time, with kitchen emailed at final district approval) surfaced a real problem: **accurate lunch counts aren't known at submission time.** The current design decouples lunch-count entry from submission entirely:

- The main form only collects a Yes/No (`school_lunch`, `Config.js`). A teacher submits real per-option names later, via a link in their confirmation email or the `?checkStatus=1` fallback page if the email is lost, never from the main form itself.
- Kitchen is only notified once a teacher actually submits real counts (`sendLunchCountsNotification`, `EmailService.js`) — never at submission, never at trip approval. `lunch_status` tracks this independently of the trip's own approval `status` (see Data model above).
- Kitchen supervisors have their own login, entirely separate from the Field-Trip Dashboard: `?lunchDashboard=1` → `LunchDashboardNew.html`, gated by `AdminAuth.js`'s `isLunch`/`isLunchDistrict`/`lunchBuildings` (from the `lunch`/`lunch_district` `_Admins` roles) — deliberately isolated from `isAdmin`/`isSuper`/`isDistrict`/`buildings`, so a lunch-only grant can never reach the trip-approval dashboard and vice versa. Any `super` admin automatically gets full Lunch Dashboard access too (mirrors the existing `isSuper` → `isDistrict` implication), without needing a separate `lunch_district` roster row. Granting the `lunch`/`lunch_district` role to actual kitchen staff happens from the same Admin Roster section of the Field-Trip Dashboard super admins already use — no separate roster UI on the Lunch Dashboard.
- `LUNCH_OPTIONS` (`_Settings`) is one option per line, `Short Name|Description` (parsed by `LunchHandlers.js`'s `parseLunchOptions`). The short name is the data key (shown next to student counts everywhere); the description is helper text only, shown to staff on the entry page so they can tell their students what's included. Editable from the Lunch Dashboard's own settings section, via a per-option name+description row editor — not from the Field-Trip Dashboard's Settings tab.
- A daily reminder (`DigestService.js`'s `sendLunchCountReminders`, its own one-time `createLunchReminderTrigger()` setup, not installed by `clasp push`) nudges teachers who haven't entered counts as the trip date nears.
- If a trip is rejected after kitchen already received real counts, a cancellation email fires (`sendLunchCancelledNotification`) and `lunch_status` flips to `Cancelled`.

## Environments (dev vs prod) — be careful here

- Two separate Apps Script projects, switched via `.clasp.json` (git-ignored): `.clasp.dev.json` / `.clasp.prod.json`, swapped with `./switch-env.sh dev|prod`.
- Git branches: `dev` (day-to-day work) → `master` (production).
- **Always run `./switch-env.sh` with no args to check the current target before `clasp push`.** Pushing to prod is a live-app change affecting real district staff — confirm with the user before pushing to prod or merging `dev` → `master`.
- `clasp push` only pushes files not excluded by `.claspignore` (see table above).
- **Important: `.clasp.prod.json`'s Apps Script project is the one serving real district staff right now** — as of 2026-08-09 it's live on this rewrite (version 46, deployment `AKfycbwvAfRXYmGgD4ehXch9HgF1MQ0ROx8vLkMKLbaTa4lBRUsJsb-f`), operating against the production spreadsheet (`1uBP3wa_trcWF2-UpWsRQPkVMqZxkMyZQLUuw4Ot22T4`) via `APP_SPREADSHEET_ID` — see "Flipping the switch to production" below for how that happened, including the legacy rollback path. **Do not `clasp push` while pointed at prod casually** — `clasp push` replaces the entire remote file set, and the bookmarked deployment only picks up new code once someone explicitly runs `clasp create-version` + `clasp redeploy` against it (same two-step pattern used for the original flip), but pushing still overwrites what `@HEAD`/test deployments see immediately. Treat any prod push as a real production change now, not a dry run against a dormant project.

## Flipping the switch to production

**Status: DONE — live since 2026-08-09.** The bookmarked URL (`AKfycbwvAfRXYmGgD4ehXch9HgF1MQ0ROx8vLkMKLbaTa4lBRUsJsb-f`) now serves version 46 of this rewrite. Prod's Script Properties `APP_SPREADSHEET_ID` is set to `1uBP3wa_trcWF2-UpWsRQPkVMqZxkMyZQLUuw4Ot22T4` (a duplicate of the dev spreadsheet, promoted to be prod's real data store — dev's own `importLegacyTrips()` history was already baked into it before duplicating, and no legacy submissions arrived after that migration, so no re-sync was needed at cutover). The legacy spreadsheet and its pre-rewrite code (`Code.js`, `forms.html`, etc.) were never modified — version 45, the last legacy version, is untouched and still deployable. The steps below are kept as a reference for how this was done, and would apply again if this project is ever repointed at yet another spreadsheet.

The goal (confirmed with the user): keep the exact same bookmarked URL staff already use, never touch the legacy spreadsheet (kept forever as the historical record), and be able to keep developing on `dev` freely until a deliberate go-live moment.

**The mechanism:** Apps Script container-bound projects can never be rebound to a different spreadsheet — so prod's project, permanently bound to the legacy spreadsheet, can't simply start operating on a fresh one just by pushing new code. Instead, every function that used to call `SpreadsheetApp.getActiveSpreadsheet()` now calls **`getAppSpreadsheet()`** (`CodeNew.js`), which checks that *project's own* Script Properties for a key called `APP_SPREADSHEET_ID`. If set, it opens that spreadsheet by ID instead of the bound one; if not set (true for `dev` today, and for prod until the flip), it falls back to `getActiveSpreadsheet()` — so this change is a no-op until someone deliberately sets that property on a given project.

**Prerequisites, prepared ahead of time with zero risk to real users** (none of this touches the live URL or the legacy spreadsheet):
1. Create prod's real spreadsheet — easiest is duplicating the dev spreadsheet (File → Make a copy), which already has the right `_Settings`/`_Admins`/column structure, then clearing out dev/test rows from `Submissions`/`Archives` (keep the header row).
2. Review and correct every value in that copy's `_Settings` sheet for production use, not dev/test values: per-building admin emails, `DESTINATION_FOLDER_ID`/`TEMPLATE_ID` (approval doc merge), `INITIAL_SUB_FOLDER_ID`/`TEMPLATE_INIT_ID` (initial submission doc), `CALENDAR_NAME`, `DISTRICT_ADMIN`/`DISTRICT_EMAIL`, `FINAL_EMAIL`, and any `<CODE>_NOTIFY_MODE`/`DISTRICT_NOTIFY_MODE` choices.
3. Review/replace the `_Admins` roster with the real building/district/super admin accounts.
4. Backfill real historical data into it: run `migrateToArchiveModel()` then `importLegacyTrips()` (both dry-run first — see `LegacyImport.js`) targeting this new spreadsheet.
5. Note the new spreadsheet's ID (from its URL).

**Wiring prod up, still with zero risk** (prod is still serving the old legacy code the whole time, which has no idea this property exists):
6. Open prod's project directly: `https://script.google.com/d/1ok4fldEd4wiQNMoLYPurBwk6SrOkUQ7a4CVJd3jgT1y9IX74k0JqBxrH/edit`
7. Project Settings (gear icon) → Script Properties → add `APP_SPREADSHEET_ID` = the new spreadsheet's ID from step 5.
8. `./switch-env.sh prod` (confirm the target!) then `clasp push` — this updates prod's source code and its `@HEAD` test deployment, but **not** the live bookmarked deployment (`AKfycbwvAfRXYmGgD4ehXch9HgF1MQ0ROx8vLkMKLbaTa4lBRUsJsb-f`) yet, same distinction learned when redeploying dev mid-session.
9. Test thoroughly against the `@HEAD`/test deployment URL (not the bookmarked one) — submit a trip, run it through building/district approval, check History/Archives/Settings, confirm doc merge and email all work against the new spreadsheet. Real users on the bookmarked URL are still hitting the untouched legacy app this whole time.

**The actual flip (the one live, no-going-back step):**
10. `clasp create-version "description"` then `clasp redeploy -V <that version number> AKfycbwvAfRXYmGgD4ehXch9HgF1MQ0ROx8vLkMKLbaTa4lBRUsJsb-f` — the instant this runs, the bookmarked URL starts serving the new app against the new spreadsheet. No URL change for anyone.
11. If using digest-mode notifications, run `createDailyDigestTrigger()` once from *this* project's editor (triggers are per-project, dev's doesn't carry over).

**Rollback, if something's wrong post-flip:** `clasp redeploy -V 45 AKfycbwvAfRXYmGgD4ehXch9HgF1MQ0ROx8vLkMKLbaTa4lBRUsJsb-f` instantly points the same bookmarked URL back at the old legacy code/version — safe and clean, since neither the legacy code nor the legacy spreadsheet were ever modified by any of the above. **Caveat:** any trips submitted through the new system between the flip and the rollback live only in the new spreadsheet (`1uBP3wa_trcWF2-UpWsRQPkVMqZxkMyZQLUuw4Ot22T4`) — rolling back the code does not bring that data back into the legacy spreadsheet. If a rollback is ever needed after real submissions have come in, those trips would need to be manually re-entered into the legacy spreadsheet (or re-imported once rolling forward again).

## De-personalizing prod: deploying identity is now `ofcsdistrict@ofcs.net`

**Status: DONE — 2026-08-12.** Prod's `appsscript.json` has `webapp.executeAs: "USER_DEPLOYING"`, which means every script operation in the web app (not just email — also `doMerge`/`doPreMerge` Drive writes and `addToCalendar`) runs as whoever most recently redeployed the live bookmarked deployment, regardless of which admin actually clicked Approve or opened the dashboard. Two-step de-personalization plan, both steps now complete:

1. Spreadsheet ownership (2026-08-09): the prod spreadsheet (`1uBP3wa_trcWF2-UpWsRQPkVMqZxkMyZQLUuw4Ot22T4`) was transferred to `ofcsdistrict@ofcs.net`, with jvanarnhem kept as Editor.
2. Deploying identity (2026-08-12): `ofcsdistrict@ofcs.net` was given Editor access to prod's bound container (sharing a bound script's container also grants script-editor access — no separate script-level share exists), signed in, accepted the OAuth consent screen, and performed the redeploy of the live deployment (`AKfycbwvAfRXYmGgD4ehXch9HgF1MQ0ROx8vLkMKLbaTa4lBRUsJsb-f`) itself. `ofcsdistrict@ofcs.net` also has Editor access to the Drive folders/templates (`DESTINATION_FOLDER_ID`, `TEMPLATE_ID`, `INITIAL_SUB_FOLDER_ID`, `TEMPLATE_INIT_ID`) and the `CALENDAR_NAME` calendar referenced in prod `_Settings` — required since those now execute as that account too.

**Ongoing workflow implication:** `clasp push` (source only, updates `@HEAD`) is unaffected and stays on jvanarnhem's clasp login as before. But from now on, whoever performs the **redeploy** step (`clasp create-version` + `clasp redeploy` against the live deployment ID, or the equivalent in the Apps Script UI) becomes the executing identity for the whole app — so future prod releases need jvanarnhem to push code, then `ofcsdistrict@ofcs.net` to sign in and do the redeploy, or the identity silently flips back to a personal account. `ofcsdistrict@ofcs.net`'s ability to run `clasp` itself hasn't been tested — manual UI redeploy is the current path; revisit if CLI-driven redeploys become worth setting up.

## Conventions

- Code is ES5-style (`var`, no arrow functions, no `let`/`const`) — this is Apps Script's V8 runtime but the existing style predates it; match it in new code.
- Server functions generally return plain objects (`{ success, message, ... }`) to the frontend via `google.script.run`, not thrown errors — frontend checks `.success`. **Exception:** any RPC returning sheet-row data built via `rowToObject` (which can carry raw `Date` values — `trip_date`, `lunch_counts_entered_date`, etc.) must instead return a `JSON.stringify()`'d string, with the client doing `JSON.parse()` on the raw response. Apps Script's built-in `google.script.run` object serialization is unreliable with Date-bearing objects — instead of throwing, it can silently deliver `null` to the browser while the server function itself completes and logs normally, which is easy to misdiagnose as an auth or data bug. `getPendingForMe`/`getHistory` (`AdminDashboardHandlers.js`) and all of `LunchHandlers.js`'s RPCs follow this stringify/parse pattern (the latter hit this exact bug in dev testing, 2026-08-12, before being fixed) — any new sheet-row-returning RPC should too.
- Times are stored as formatted 12-hour strings (`formatTimeTo12Hour`) and written with `setNumberFormat('@')` to stop Sheets from re-interpreting them as datetimes.
- Submission numbers are `+new Date()` (millisecond timestamp), not sequential — used as the row lookup key everywhere (`findSubmission`).
