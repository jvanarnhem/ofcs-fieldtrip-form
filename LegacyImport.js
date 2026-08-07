/**
 * Legacy Data Import + Archive Cutover (one-time migration tools)
 *
 * Run manually from the Apps Script editor - not wired into the dashboard, since
 * these are expected to run once (maybe twice), then never again:
 *
 *   1. migrateToArchiveModel() - splits whatever's currently in this app's own
 *      Submissions/Completed sheets by trip_date: anything before
 *      ARCHIVE_CUTOFF_DATE (Config.js) moves into Archives, everything else
 *      lands (or stays) in Submissions. Run this FIRST, once, to retire the
 *      Completed sheet - Completed itself is left untouched/unwritten so it acts
 *      as a backup; delete or rename it yourself once you've checked the result.
 *
 *   2. importLegacyTrips() - backfills historical trips from the old pre-rewrite
 *      app's own spreadsheet (hardcoded LEGACY_SPREADSHEET_ID). Each row is routed
 *      by its own trip_date, same as above: a legacy row dated on/after the
 *      cutover lands in Submissions (so it shows up as a live current trip),
 *      everything else lands in Archives.
 *
 * Both default to a dry run (logs everything, writes nothing); pass false to
 * actually commit. IMPORTANT: run against the dev project/sheet first and check
 * the results before running against prod - see CLAUDE.md's Environments section.
 *
 * Usage from the Apps Script editor's function dropdown (no arguments needed -
 * the dropdown can't pass parameters, so the "live" wrappers below exist just to
 * make picking dryRun=false a matter of which function you select, not editing code):
 *   1. migrateToArchiveModel            -> dry run, review the Execution log
 *   2. runMigrateToArchiveModelLive     -> actually writes/moves rows
 *   3. importLegacyTrips                -> dry run, review the Execution log
 *   4. runImportLegacyTripsLive         -> actually writes the rows
 */

var LEGACY_SPREADSHEET_ID = '1Tuas-Xy8RhpPhQljk5j4W-RTW_c4zUd6aFUNDY13WDI';

// Rejected rows live in "Submissions" too (never moved out) in the old app, same as
// ours - but the live "Submissions" tab there also holds ~17 old (2021-2022) rows
// still marked Pending that were never resolved. Per a deliberate decision, those
// are left out of the import entirely (not resurrected into anyone's live queue),
// so that tab is intentionally not in this list.
var LEGACY_SOURCE_SHEETS = ['Completed', 'Rejected', 'Archive6_24', 'Archive10_22'];

var LEGACY_COLUMNS = ['SubmissionNumber', 'Timestamp', 'DayOfWeek', 'Destination', 'Trip_Date', 'Building',
  'Adult_in_Charge', 'Adult_Email', 'Phone', 'Adults_Assisting', 'Number_Adults', 'Number_Students',
  'Large_Buses', 'Small_Buses', 'Vans', 'Depart_From', 'Destination_Address', 'School_Depart_Time',
  'Dest_Arrive_Time', 'Dest_Depart_Time', 'School_Arrive_Time', 'Eat_Stop', 'Restroom_Stop',
  'Purpose_Comments', 'STATUS', 'Building Admin', 'Building Admin Comments', 'District Admin Comments', 'Document_Link'];

/**
 * Translates a legacy STATUS string to one of our STATUS_VALUES
 * @param {string} raw - Legacy STATUS cell value
 * @returns {string|null} A STATUS_VALUES entry, or null if unrecognized (caller should skip + log)
 */
function translateLegacyStatus(raw) {
  var s = String(raw || '').trim().toLowerCase();
  if (s === 'approved') return STATUS_VALUES.APPROVED;
  if (s.indexOf('reject') !== -1) return STATUS_VALUES.REJECTED;
  return null; // includes any "Pending..." status - those are deliberately skipped, see above
}

/**
 * Normalizes a legacy time value ("8:45 am", a Date, etc.) to our stored
 * "h:mm AM/PM" format (see formatTimeTo12Hour in DataLayer.js)
 * @param {*} raw - Legacy time cell value
 * @returns {string} Normalized time string, or '' if empty/unparseable
 */
function normalizeTimeString(raw) {
  if (!raw) return '';
  var str = String(raw).trim();

  var match = str.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (match) {
    return parseInt(match[1], 10) + ':' + match[2] + ' ' + match[3].toUpperCase();
  }

  var d = raw instanceof Date ? raw : new Date(raw);
  if (!isNaN(d)) {
    return formatTimeTo12Hour(Utilities.formatDate(d, Session.getScriptTimeZone(), 'HH:mm'));
  }

  return str;
}

/**
 * Normalizes a legacy Timestamp value to our stored 'MM/dd/yyyy HH:mm:ss' format
 * @param {*} raw - Legacy Timestamp cell value
 * @returns {string}
 */
function normalizeTimestamp(raw) {
  var d = raw instanceof Date ? raw : new Date(raw);
  if (isNaN(d)) return String(raw || '');
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'MM/dd/yyyy HH:mm:ss');
}

/**
 * Normalizes a Yes/No-ish legacy value to exactly 'Yes' or 'No'
 * @param {*} raw
 * @returns {string}
 */
function normalizeYesNo(raw) {
  return /^y/i.test(String(raw || '').trim()) ? 'Yes' : 'No';
}

/**
 * Recomputes day-of-week from a "YYYY-MM-DD" trip date, same logic appendSubmission uses
 * @param {string} tripDate - "YYYY-MM-DD"
 * @returns {string}
 */
function computeDayOfWeek(tripDate) {
  var parts = tripDate.split('-');
  var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[d.getDay()];
}

/**
 * Known legacy data-entry bug: some rows have a trip_date stored exactly 100 years
 * off (e.g. "1925-05-08" instead of "2025-05-08"), confirmed by cross-checking a
 * sample against each row's own Timestamp - the +100-year date consistently lands
 * a plausible few weeks after submission. Only corrects when that check holds;
 * anything else with a pre-2015 year is left alone and still flagged as suspicious
 * by the caller, not guessed at further.
 * @param {string} tripDate - "YYYY-MM-DD", already known to have a year before 2015
 * @param {*} timestampRaw - Raw legacy Timestamp cell value
 * @returns {string|null} Corrected "YYYY-MM-DD", or null if the pattern doesn't hold
 */
function correctLegacyTripYear(tripDate, timestampRaw) {
  var parts = tripDate.split('-');
  var year = parseInt(parts[0], 10);
  var correctedDate = new Date(year + 100, parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));

  var submitted = timestampRaw instanceof Date ? timestampRaw : new Date(timestampRaw);
  if (isNaN(submitted)) return null;

  var daysAfterSubmission = Math.round((correctedDate - submitted) / 86400000);
  // Plausible if the corrected date falls within a year after submission (with a
  // little backward slack too, in case Timestamp trails Trip_Date slightly)
  if (daysAfterSubmission < -30 || daysAfterSubmission > 365) return null;

  return normalizeTripDateString(correctedDate);
}

/**
 * Maps one legacy row (as a lookup by column name) to our FORM_SCHEMA-keyed dataObject.
 * Returns a skipReason if the row can't be mapped - caller decides how to log it.
 * @param {Object} get - function(columnName) -> raw cell value for this row
 * @returns {{dataObj: Object, tripDate: string, corrected: boolean}|{skipReason: string}}
 */
function mapLegacyRow(get) {
  var rawStatus = get('STATUS');
  var status = translateLegacyStatus(rawStatus);
  if (!status) {
    return { skipReason: 'unrecognized STATUS "' + rawStatus + '"' };
  }

  var tripDate = normalizeTripDateString(get('Trip_Date'));
  if (!tripDate) {
    return { skipReason: 'unparseable Trip_Date "' + get('Trip_Date') + '"' };
  }

  var corrected = false;
  if (parseInt(tripDate.split('-')[0], 10) < 2015) {
    var fixedDate = correctLegacyTripYear(tripDate, get('Timestamp'));
    if (fixedDate) {
      tripDate = fixedDate;
      corrected = true;
    }
  }

  var assisting = get('Adults_Assisting');
  var comments = assisting ? 'Assisting adults: ' + assisting : '';

  var dataObj = {
    submission_number: get('SubmissionNumber'),
    timestamp: normalizeTimestamp(get('Timestamp')),
    day_of_week: computeDayOfWeek(tripDate),
    destination: sanitizeInput(String(get('Destination') || '')),
    trip_date: tripDate,
    building: String(get('Building') || '').trim(),
    adult_in_charge: sanitizeInput(String(get('Adult_in_Charge') || '')),
    email: sanitizeInput(String(get('Adult_Email') || '')),
    phone: formatPhone(sanitizeInput(String(get('Phone') || ''))),
    num_adults: parseInt(get('Number_Adults'), 10) || 0,
    num_students: parseInt(get('Number_Students'), 10) || 0,
    num_large_buses: parseInt(get('Large_Buses'), 10) || 0,
    num_small_buses: parseInt(get('Small_Buses'), 10) || 0,
    num_vans: parseInt(get('Vans'), 10) || 0,
    depart_from: sanitizeInput(String(get('Depart_From') || '')),
    destination_address: sanitizeInput(String(get('Destination_Address') || '')),
    leave_school: normalizeTimeString(get('School_Depart_Time')),
    arrive_destination: normalizeTimeString(get('Dest_Arrive_Time')),
    leave_destination: normalizeTimeString(get('Dest_Depart_Time')),
    arrive_school: normalizeTimeString(get('School_Arrive_Time')),
    extra_stop_eat: normalizeYesNo(get('Eat_Stop')),
    extra_stop_restroom: normalizeYesNo(get('Restroom_Stop')),
    purpose: sanitizeInput(String(get('Purpose_Comments') || '')),
    comments_requests: sanitizeInput(comments),
    status: status,
    building_admin: sanitizeInput(String(get('Building Admin') || '')),
    building_comments: sanitizeInput(String(get('Building Admin Comments') || '')),
    district_comments: sanitizeInput(String(get('District Admin Comments') || '')),
    approval_doc_url: String(get('Document_Link') || '').trim()
  };

  return { dataObj: dataObj, tripDate: tripDate, corrected: corrected };
}

/**
 * Batch-writes a set of already-mapped dataObjects into a sheet, reusing the same
 * column-mapping helpers as the live app (DataLayer.js), so reordering columns
 * later won't break this. Creates the destination sheet (with FORM_SCHEMA headers)
 * if it doesn't exist yet - e.g. the first time anything writes to "Archives".
 * @param {string} sheetName - 'Submissions' or 'Archives'
 * @param {Object[]} dataObjs
 * @returns {number} Rows written
 */
function writeImportedRows(sheetName, dataObjs) {
  if (!dataObjs.length) return 0;

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    // Write the header row explicitly on creation - ensureColumnsExist's "append
    // missing columns after the last one" logic assumes a header row already
    // exists, so a brand-new sheet needs this before that call, not instead of it
    sheet = spreadsheet.insertSheet(sheetName);
    var headers = getColumnHeaders();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  ensureColumnsExist(sheet);
  var columnMapping = getColumnMapping(sheet);

  var rows = dataObjs.map(function (obj) {
    return objectToRow(obj, columnMapping);
  });

  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);

  // Force date/time-like columns to plain text so Sheets doesn't reinterpret them -
  // same reasoning as appendSubmission, just applied to the whole imported block at once
  var textColumns = ['Timestamp', 'Trip_Date', 'Leave_School', 'Arrive_Destination', 'Leave_Destination', 'Arrive_School'];
  textColumns.forEach(function (header) {
    var colIndex = columnMapping[header];
    if (colIndex !== undefined) {
      sheet.getRange(startRow, colIndex + 1, rows.length, 1).setNumberFormat('@');
    }
  });

  return rows.length;
}

/**
 * One-time cutover: splits whatever's currently in this app's own Submissions and
 * Completed sheets by trip_date, so the Submissions/Completed split can be retired
 * in favor of a single Submissions sheet + a separate Archives sheet. Completed is
 * only ever read here, never written or cleared - once you've verified the result,
 * delete or rename it yourself.
 * @param {boolean} [dryRun=true] - If true, only logs what would happen; writes nothing
 */
function migrateToArchiveModel(dryRun) {
  if (dryRun === undefined) dryRun = true;

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var submissionsSheet = spreadsheet.getSheetByName('Submissions');
  var completedSheet = spreadsheet.getSheetByName('Completed');

  if (!submissionsSheet) {
    Logger.log('migrateToArchiveModel: Submissions sheet not found - aborting.');
    return;
  }

  ensureColumnsExist(submissionsSheet);
  var subColumnMapping = getColumnMapping(submissionsSheet);
  var subData = submissionsSheet.getDataRange().getValues();

  var keepInSubmissions = []; // raw row arrays, unchanged
  var moveToArchives = []; // dataObjects, re-encoded via objectToRow when written

  for (var i = 1; i < subData.length; i++) {
    var rowObj = rowToObject(subData[i], subColumnMapping);
    if (isArchivedTripDate(rowObj.trip_date)) {
      moveToArchives.push(rowObj);
    } else {
      keepInSubmissions.push(subData[i]);
    }
  }

  var fromCompletedCurrent = [];
  if (completedSheet) {
    var compColumnMapping = getColumnMapping(completedSheet);
    var compData = completedSheet.getDataRange().getValues();

    for (var j = 1; j < compData.length; j++) {
      var compObj = rowToObject(compData[j], compColumnMapping);
      if (isArchivedTripDate(compObj.trip_date)) {
        moveToArchives.push(compObj);
      } else {
        fromCompletedCurrent.push(compObj);
      }
    }
  } else {
    Logger.log('migrateToArchiveModel: no Completed sheet found - nothing to pull from it.');
  }

  Logger.log('=== Migrate to archive model ' + (dryRun ? '(DRY RUN - nothing written)' : '(LIVE)') + ' ===');
  Logger.log('Submissions rows staying in Submissions: ' + keepInSubmissions.length);
  Logger.log('Completed rows moving into Submissions (still current): ' + fromCompletedCurrent.length);
  Logger.log('Rows moving to Archives (from both sheets, combined): ' + moveToArchives.length);

  if (dryRun) {
    return;
  }

  var promotedRows = fromCompletedCurrent.map(function (obj) {
    return objectToRow(obj, subColumnMapping);
  });
  var newSubmissionsRows = keepInSubmissions.concat(promotedRows);

  if (submissionsSheet.getLastRow() > 1) {
    submissionsSheet.getRange(2, 1, submissionsSheet.getLastRow() - 1, submissionsSheet.getLastColumn()).clearContent();
  }
  if (newSubmissionsRows.length) {
    submissionsSheet.getRange(2, 1, newSubmissionsRows.length, newSubmissionsRows[0].length).setValues(newSubmissionsRows);
  }

  var archivedCount = writeImportedRows('Archives', moveToArchives);

  Logger.log('Migration complete. Submissions now has ' + newSubmissionsRows.length + ' row(s); Archives gained ' + archivedCount + ' row(s).');
  Logger.log('Completed was left untouched - delete or rename that tab yourself once you\'ve checked the result.');
}

/**
 * Imports historical trips from the legacy app's spreadsheet, routing each row by
 * its own trip_date: on/after ARCHIVE_CUTOFF_DATE lands in Submissions (shows up
 * as a live current trip), everything else lands in Archives. Defaults to a dry
 * run - pass false to actually write.
 * @param {boolean} [dryRun=true] - If true, only logs what would happen; writes nothing
 */
function importLegacyTrips(dryRun) {
  if (dryRun === undefined) dryRun = true;

  var legacySpreadsheet = SpreadsheetApp.openById(LEGACY_SPREADSHEET_ID);

  var seen = {}; // submission_number -> source sheet name it was first found in
  var toSubmissions = [];
  var toArchives = [];
  var skippedDuplicates = [];
  var skippedUnmappable = [];
  var correctedDates = [];
  var suspiciousDates = [];

  LEGACY_SOURCE_SHEETS.forEach(function (sheetName) {
    var sheet = legacySpreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log('importLegacyTrips: legacy sheet not found - ' + sheetName);
      return;
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function (h) { return String(h).trim(); });
    var colIndex = {};
    LEGACY_COLUMNS.forEach(function (col) {
      colIndex[col] = headers.indexOf(col);
    });

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var get = function (col) {
        var idx = colIndex[col];
        return idx === -1 || idx === undefined ? '' : row[idx];
      };

      var subNum = get('SubmissionNumber');
      if (!subNum) continue;

      if (seen[subNum]) {
        skippedDuplicates.push(subNum + ' (' + sheetName + ', already imported from ' + seen[subNum] + ')');
        continue;
      }

      var mapped = mapLegacyRow(get);
      if (mapped.skipReason) {
        skippedUnmappable.push(subNum + ' (' + sheetName + '): ' + mapped.skipReason);
        continue;
      }

      seen[subNum] = sheetName;

      if (mapped.corrected) {
        correctedDates.push(subNum + ': corrected trip_date to ' + mapped.tripDate + ' (was 100 years off)');
      }

      var year = parseInt(mapped.tripDate.split('-')[0], 10);
      if (year < 2015 || year > new Date().getFullYear() + 2) {
        suspiciousDates.push(subNum + ': trip_date parsed as ' + mapped.tripDate);
      }

      if (isArchivedTripDate(mapped.tripDate)) {
        toArchives.push(mapped.dataObj);
      } else {
        toSubmissions.push(mapped.dataObj);
      }
    }
  });

  Logger.log('=== Legacy import ' + (dryRun ? '(DRY RUN - nothing written)' : '(LIVE)') + ' ===');
  Logger.log('Would import to Archives: ' + toArchives.length);
  Logger.log('Would import to Submissions (post-cutover trip dates): ' + toSubmissions.length);
  Logger.log('Skipped duplicates (' + skippedDuplicates.length + '): ' + skippedDuplicates.join('; '));
  Logger.log('Skipped unmappable rows (' + skippedUnmappable.length + '): ' + skippedUnmappable.join('; '));
  Logger.log('Corrected trip dates (100-year data-entry bug, ' + correctedDates.length + '): ' + correctedDates.join('; '));
  Logger.log('Still-suspicious trip dates to review by hand (' + suspiciousDates.length + '): ' + suspiciousDates.join('; '));

  if (dryRun) {
    return;
  }

  var archivedCount = writeImportedRows('Archives', toArchives);
  var submissionsCount = writeImportedRows('Submissions', toSubmissions);

  Logger.log('Import complete. Wrote ' + archivedCount + ' row(s) to Archives, ' + submissionsCount + ' row(s) to Submissions.');
}

/**
 * Convenience wrapper so the Apps Script editor's function dropdown (which can't
 * pass arguments) can run the real, writing pass without hand-editing code
 */
function runMigrateToArchiveModelLive() {
  migrateToArchiveModel(false);
}

/**
 * Convenience wrapper so the Apps Script editor's function dropdown (which can't
 * pass arguments) can run the real, writing pass without hand-editing code
 */
function runImportLegacyTripsLive() {
  importLegacyTrips(false);
}
