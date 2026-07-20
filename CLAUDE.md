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

This repo went through an in-place rewrite, and the "new" files are the ones actually deployed — the plain-named files are legacy backups kept for reference/git history only. **`.claspignore` is the source of truth**, not filenames:

```
Code.js, forms.html, buildAdmin.html, districtAdmin.html   ← NOT pushed (legacy, read-only reference)
```

Everything else in the repo root **is** pushed via `clasp push` and is live:

| Active file | Role |
|---|---|
| `CodeNew.js` | `doGet` router — main form / building admin / district admin / legacy quick-reject dispatch. Also holds `getSettings()`, `JSONCacheService()`, the legacy `update()` shim. |
| `Config.js` | `FORM_SCHEMA` — single source of truth for form fields, column headers, validation flags. Add/rename a field here first. |
| `DataLayer.js` | Sheet I/O: column-header-based mapping (`getColumnMapping`), `appendSubmission`, `findSubmission`, `updateSubmission`, `moveToCompleted`. Uses `LockService` on append to avoid concurrent-submission collisions. |
| `ValidationUtils.js` | `sanitizeInput`/`sanitizeFormData` (XSS-safe), `validateFormData` against `FORM_SCHEMA`, cross-field time-sequence checks. |
| `FormHandlers.js` | Entry points called from the HTML via `google.script.run`: `submitFieldTripForm`, `approveBuildingAdmin`, `approveDistrictAdmin`, `getSubmissionData`. |
| `EmailService.js` | All HTML email bodies (submission, approval, rejection notifications). |
| `Merge.js` / `PreMerge.js` | Google Doc template merge — `doMerge` (final approved doc) / `doPreMerge` (initial submission receipt). Placeholder syntax: `[Column_Header]` in the template doc, matched against sheet header row. |
| `CalendarAdd.js` | `addToCalendar` — adds the trip to a named Calendar. |
| `FormNew.html`, `BuildingAdminNew.html`, `DistrictAdminNew.html`, `DoneAlready.html`, `FormTest.html` | Bootstrap 5 frontends (dark blue / pink / blue themed respectively). |

When asked to "update the form" or "fix the admin page," edit the `*New.html` / `*New.js` files, not the legacy ones, unless told otherwise.

## Known inconsistency (do not silently "fix" — confirm with user first)

`CalendarAdd.js`'s `addToCalendar(data3, name, docURL)` still expects the **old** flat field names (`data3['tripdate']`, `data3['subNum']`, `data3['adultincharge']`, `data3['leaveschool']`) and 3 arguments. But `FormHandlers.js` calls it as `addToCalendar(submission.dataObject)` — one argument, using the **new** `FORM_SCHEMA` keys (`trip_date`, `destination`, `leave_school`, etc.). This means calendar events are currently created with `undefined` values for name/dates. If asked to touch calendar integration, flag this mismatch rather than assuming which side is correct.

## Data model

- `Config.js`'s `FORM_SCHEMA` object is the single source of truth: field key → `{ type, columnHeader, required, label, ... }`. Sheet columns are matched **by header text**, not position, so column reordering in the sheet is safe.
- Status workflow lives in `STATUS_VALUES` (`Config.js`): `Pending Building Approval` → `Pending District Approval` → `Approved`/`Rejected`.
- Submissions live in the `Submissions` sheet while pending, then `moveToCompleted()` copies the row to `Completed` on final approval.
- Runtime config (admin emails per building, template/folder IDs, calendar name) lives in the `_Settings` sheet, loaded once per execution via `getSettings()`.

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
