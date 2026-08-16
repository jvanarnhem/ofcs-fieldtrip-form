/**
 * Lunch Dashboard Backend Functions
 * RPC endpoints called from LunchEntryNew.html (teacher-facing counts entry) and
 * LunchDashboardNew.html (Food Services Department Staff's own dashboard, ?lunchDashboard=1).
 * Deliberately separate from AdminDashboardHandlers.js/SettingsHandlers.js so lunch
 * permissions (AdminAuth.js's isLunch/isLunchDistrict/lunchBuildings) never
 * entangle with trip-approval permissions (isAdmin/isSuper/isDistrict/buildings).
 */

var LUNCH_GLOBAL_SETTINGS_KEYS = [
  'LUNCH_OPTIONS', 'LUNCH_CENTRAL_EMAIL',
  'LUNCH_COST_TIER1_GRADES', 'LUNCH_COST_TIER1_AMOUNT',
  'LUNCH_COST_TIER2_GRADES', 'LUNCH_COST_TIER2_AMOUNT'
];

/**
 * Builds the "Lunch cost: $X for <grades>, $Y for <grades>, and is free for..."
 * reminder sentence shown on the form, the confirmation email, and the lunch
 * count entry page - one place so the three stay in sync. Amounts/grade
 * ranges are dashboard-configurable (see LUNCH_GLOBAL_SETTINGS_KEYS above);
 * falls back to today's real values if a key hasn't been set yet.
 * @param {Object} settings - _Settings map (getSettings())
 * @returns {string}
 */
function buildLunchCostReminderText(settings) {
  var tier1Grades = settings.LUNCH_COST_TIER1_GRADES || 'K-5';
  var tier1Amount = settings.LUNCH_COST_TIER1_AMOUNT || '3.00';
  var tier2Grades = settings.LUNCH_COST_TIER2_GRADES || '6-12';
  var tier2Amount = settings.LUNCH_COST_TIER2_AMOUNT || '3.35';

  return 'Lunch cost: $' + tier1Amount + ' for ' + tier1Grades + ', $' + tier2Amount +
    ' for ' + tier2Grades + ', and is free for the students on the free/reduced meal program.';
}

/**
 * Parses the LUNCH_OPTIONS setting into short name + helper description pairs.
 * Format: one option per line, "Short Name|Description" - the description is
 * only ever shown to staff as context for their students (e.g. what's in the
 * meal) and is never used as a data key. The lunch_names blob (see
 * parseLunchNamesString, EmailService.js) is keyed by name alone.
 * @param {string} str - Raw LUNCH_OPTIONS setting value
 * @returns {Object[]} [{ name, description }, ...]
 */
function parseLunchOptions(str) {
  return String(str || '')
    .split('\n')
    .map(function (line) {
      var parts = line.split('|');
      return {
        name: (parts[0] || '').trim(),
        description: parts.slice(1).join('|').trim()
      };
    })
    .filter(function (opt) { return opt.name; });
}

/**
 * Teacher-facing: submits (or updates) the per-option student name lists for a
 * trip that requested school-provided lunch. Re-checks identity server-side -
 * the page-load gate in CodeNew.js's doGet is not trusted alone.
 * @param {number} idNum - The submission number
 * @param {string} lunchNamesValue - The already-built "---"-delimited names blob
 *   (same format FormNew.html used to build client-side - see parseLunchNamesString
 *   in EmailService.js for the read side)
 * @returns {string} JSON-stringified { success, message } - stringified (rather
 *   than returned as a raw object) because Apps Script's automatic google.script.run
 *   serialization of raw objects containing Date values (lunch_counts_entered_date
 *   etc.) has proven unreliable, silently delivering null to the client instead of
 *   throwing; every other Submissions-scanning RPC in this codebase
 *   (getPendingForMe/getHistory, AdminDashboardHandlers.js) already works around
 *   this the same way - stringify server-side, JSON.parse() client-side.
 */
function submitLunchCounts(idNum, lunchNamesValue) {
  try {
    var submission = findSubmission(idNum);
    if (!submission) {
      return JSON.stringify({ success: false, message: 'Submission not found.' });
    }

    var visitorEmail = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
    var submissionEmail = String(submission.dataObject.email || '').trim().toLowerCase();
    if (!visitorEmail || visitorEmail !== submissionEmail) {
      return JSON.stringify({ success: false, message: 'Not authorized.' });
    }

    if (submission.dataObject.status === STATUS_VALUES.REJECTED) {
      return JSON.stringify({ success: false, message: 'This trip has been cancelled - no lunch is needed.' });
    }

    // Once Food Services has marked a request Done, it's locked from the teacher's
    // side - further changes go through Food Services directly (see the Lunch
    // Dashboard's own Edit action, LunchHandlers.js's adminUpdateLunchCounts),
    // since the order may already be placed/prepared by this point.
    if (submission.dataObject.lunch_status === LUNCH_STATUS_VALUES.COMPLETED) {
      return JSON.stringify({ success: false, message: 'This request has already been processed by Food Services. Please contact them directly to make changes.' });
    }

    var lunchNames = sanitizeInput(String(lunchNamesValue || ''));

    updateSubmission(idNum, {
      lunch_names: lunchNames,
      lunch_status: LUNCH_STATUS_VALUES.COUNTS_PROVIDED,
      lunch_counts_entered_date: new Date()
    });

    submission.dataObject.lunch_names = lunchNames;
    sendLunchCountsNotification(submission.dataObject, getSettings());

    return JSON.stringify({ success: true });
  } catch (error) {
    Logger.log('submitLunchCounts error: ' + error);
    notifySystemError('submitLunchCounts', error);
    return JSON.stringify({ success: false, message: 'An error occurred submitting lunch counts.' });
  }
}

/**
 * Shared authorization check for the Food Services-facing actions below
 * (markLunchRequestDone/cancelLunchRequest/adminUpdateLunchCounts) - confirms
 * the visitor is a lunch admin for this trip's building and returns the
 * submission, or an error response to return as-is.
 * @param {number} idNum
 * @returns {Object} { submission } on success, or { error: <JSON string> } on failure
 */
function _getLunchActionableSubmission(idNum) {
  var ctx = getAdminContext(Session.getActiveUser().getEmail());
  if (!ctx.isLunch) {
    return { error: JSON.stringify({ success: false, message: 'Not authorized.' }) };
  }

  var submission = findSubmission(idNum);
  if (!submission) {
    return { error: JSON.stringify({ success: false, message: 'Submission not found.' }) };
  }

  if (!canActOnLunch(ctx, submission.dataObject.building)) {
    return { error: JSON.stringify({ success: false, message: 'Not authorized for this building.' }) };
  }

  return { submission: submission };
}

/**
 * Food Services-facing: marks a lunch request Done once the order's been
 * prepared/handled on their end. Deliberately doesn't move the trip to the
 * Lunch Dashboard's History view by itself - it stays in Requests (with its
 * status badge as the only indicator) until trip_date actually passes, since
 * Food Services may still need to see or amend it right up to that day.
 * @param {number} idNum
 * @returns {string} JSON-stringified { success, message }
 */
function markLunchRequestDone(idNum) {
  try {
    var result = _getLunchActionableSubmission(idNum);
    if (result.error) return result.error;

    updateSubmission(idNum, { lunch_status: LUNCH_STATUS_VALUES.COMPLETED });
    return JSON.stringify({ success: true });
  } catch (error) {
    Logger.log('markLunchRequestDone error: ' + error);
    notifySystemError('markLunchRequestDone', error);
    return JSON.stringify({ success: false, message: 'An error occurred marking this request done.' });
  }
}

/**
 * Food Services-facing: manually cancels a lunch request (e.g. entered by
 * mistake, or the teacher says lunch is no longer needed) - separate from the
 * automatic cancellation that fires when the trip itself is rejected
 * (FormHandlers.js). Reuses the same 'Cancelled' lunch_status so both paths
 * behave identically everywhere the status is read; the trip's own approval
 * status and lunch_names/counts are left untouched so this shows up in the
 * Lunch Dashboard's History view as a record of what was cancelled, not wiped.
 * @param {number} idNum
 * @returns {string} JSON-stringified { success, message }
 */
function cancelLunchRequest(idNum) {
  try {
    var result = _getLunchActionableSubmission(idNum);
    if (result.error) return result.error;

    updateSubmission(idNum, { lunch_status: LUNCH_STATUS_VALUES.CANCELLED });
    return JSON.stringify({ success: true });
  } catch (error) {
    Logger.log('cancelLunchRequest error: ' + error);
    notifySystemError('cancelLunchRequest', error);
    return JSON.stringify({ success: false, message: 'An error occurred cancelling this request.' });
  }
}

/**
 * Food Services-facing: lets a lunch admin correct a trip's submitted counts/
 * names directly (e.g. a teacher calls in a change) - unlike submitLunchCounts,
 * this isn't gated on being the submitting teacher, just on being an
 * authorized lunch admin for the trip's building. If counts hadn't been
 * entered yet at all, this also flips the status forward the same way
 * submitLunchCounts does; an edit to already-provided counts leaves whatever
 * status the trip was already in (including Completed) alone.
 * @param {number} idNum
 * @param {string} lunchNamesValue - Same "---"-delimited blob format as submitLunchCounts
 * @returns {string} JSON-stringified { success, message }
 */
function adminUpdateLunchCounts(idNum, lunchNamesValue) {
  try {
    var result = _getLunchActionableSubmission(idNum);
    if (result.error) return result.error;

    var lunchNames = sanitizeInput(String(lunchNamesValue || ''));
    var updates = {
      lunch_names: lunchNames,
      lunch_counts_entered_date: new Date()
    };

    if (result.submission.dataObject.lunch_status === LUNCH_STATUS_VALUES.AWAITING_COUNTS) {
      updates.lunch_status = LUNCH_STATUS_VALUES.COUNTS_PROVIDED;
    }

    updateSubmission(idNum, updates);
    return JSON.stringify({ success: true });
  } catch (error) {
    Logger.log('adminUpdateLunchCounts error: ' + error);
    notifySystemError('adminUpdateLunchCounts', error);
    return JSON.stringify({ success: false, message: 'An error occurred updating lunch counts.' });
  }
}

/**
 * Food Services Department-facing: returns every trip that has requested lunch, scoped to the
 * visitor's building(s) unless they're the district-wide lunch contact.
 * Archives intentionally excluded, matching getMySubmissions' precedent - lunch
 * counts are always entered well before a trip could age into Archives.
 * @returns {string} JSON-stringified { success, trips } - stringified for the
 *   same reason as submitLunchCounts above (Date-bearing rows via rowToObject).
 */
function getLunchDashboardData() {
  try {
    var ctx = getAdminContext(Session.getActiveUser().getEmail());
    if (!ctx.isLunch) {
      return JSON.stringify({ success: false, message: 'Not authorized.' });
    }

    var sheet = getAppSpreadsheet().getSheetByName('Submissions');
    var columnMapping = getColumnMapping(sheet);
    var data = sheet.getDataRange().getValues();

    var lunchStatusCol = columnMapping[FORM_SCHEMA.lunch_status.columnHeader];
    var buildingCol = columnMapping[FORM_SCHEMA.building.columnHeader];

    var trips = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][lunchStatusCol]) {
        continue;
      }

      var building = data[i][buildingCol];
      if (!canActOnLunch(ctx, building)) {
        continue;
      }

      trips.push(rowToObject(data[i], columnMapping));
    }

    trips.sort(function (a, b) {
      return new Date(a.trip_date) - new Date(b.trip_date);
    });

    return JSON.stringify({ success: true, trips: trips });
  } catch (error) {
    Logger.log('getLunchDashboardData error: ' + error);
    notifySystemError('getLunchDashboardData', error);
    return JSON.stringify({ success: false, message: 'An error occurred loading lunch data.' });
  }
}

/**
 * Gets the lunch-related _Settings this visitor is allowed to see/edit, scoped
 * by role - mirrors getSettingsForDashboard's shape (SettingsHandlers.js) but
 * gated by isLunch/isLunchDistrict/lunchBuildings instead of isSuper/isDistrict.
 * @returns {string} JSON-stringified { success, global, buildings } - global is
 *   null for a building-only lunch admin. Stringified for consistency with the
 *   other lunch RPCs above (see submitLunchCounts) even though this one has no
 *   Date fields today - keeps the whole file on one convention.
 */
function getLunchSettingsForDashboard() {
  try {
    var ctx = getAdminContext(Session.getActiveUser().getEmail());
    if (!ctx.isLunch) {
      return JSON.stringify({ success: false, message: 'Not authorized.' });
    }

    var settings = getSettings();

    var global = null;
    if (ctx.isLunchDistrict) {
      global = {};
      LUNCH_GLOBAL_SETTINGS_KEYS.forEach(function (key) {
        global[key] = settings[key] || '';
      });
    }

    var buildingCodes = ctx.isLunchDistrict ? FORM_SCHEMA.building.options : ctx.lunchBuildings;
    var buildings = {};
    buildingCodes.forEach(function (code) {
      buildings[code] = {
        lunchEmail: settings[code + '_LUNCH_EMAIL'] || ''
      };
    });

    return JSON.stringify({ success: true, global: global, buildings: buildings });
  } catch (error) {
    Logger.log('getLunchSettingsForDashboard error: ' + error);
    notifySystemError('getLunchSettingsForDashboard', error);
    return JSON.stringify({ success: false, message: 'An error occurred loading lunch settings.' });
  }
}

/**
 * Saves a batch of lunch-related settings, skipping any key this visitor isn't
 * permitted to touch. Same _Settings sheet/keys as before, own permission gate.
 * @param {string} updatesJson - JSON string: flat { KEY: value } map
 * @returns {string} JSON-stringified { success, saved: [keys], skipped: [keys] } -
 *   stringified for consistency with the other lunch RPCs above.
 */
function saveLunchSettings(updatesJson) {
  try {
    var ctx = getAdminContext(Session.getActiveUser().getEmail());
    if (!ctx.isLunch) {
      return JSON.stringify({ success: false, message: 'Not authorized.' });
    }

    var updates = JSON.parse(updatesJson);
    var sheet = getAppSpreadsheet().getSheetByName(SETTINGS_SHEET);

    var saved = [];
    var skipped = [];

    for (var key in updates) {
      var permitted = false;

      if (LUNCH_GLOBAL_SETTINGS_KEYS.indexOf(key) !== -1) {
        permitted = ctx.isLunchDistrict;
      } else {
        var match = /^([A-Z]+)_LUNCH_EMAIL$/.exec(key);
        var buildingCode = match ? match[1] : null;
        if (buildingCode && FORM_SCHEMA.building.options.indexOf(buildingCode) !== -1) {
          permitted = ctx.isLunchDistrict || ctx.lunchBuildings.indexOf(buildingCode) !== -1;
        }
      }

      if (!permitted) {
        skipped.push(key);
        continue;
      }

      setSettingValue(sheet, key, sanitizeInput(String(updates[key] || '')));
      saved.push(key);
    }

    cache.remove('_settings');

    return JSON.stringify({ success: true, saved: saved, skipped: skipped });
  } catch (error) {
    Logger.log('saveLunchSettings error: ' + error);
    notifySystemError('saveLunchSettings', error);
    return JSON.stringify({ success: false, message: 'An error occurred saving lunch settings.' });
  }
}
