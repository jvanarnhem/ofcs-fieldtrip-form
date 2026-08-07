/**
 * Admin Dashboard Backend Functions
 * RPC endpoints called from AdminDashboardNew.html via google.script.run
 * Every function starts by checking getDashboardContext() - see AdminAuth.js
 */

var BULK_ACTION_LIMIT = 20;

/**
 * Looks up the building admin's email/name from _Settings for notification purposes
 * @param {Object} settings - Result of getSettings()
 * @param {string} building - Building code
 * @returns {Object} { email, name }
 */
function getBuildingAdminContact(settings, building) {
  var contactsByBuilding = {
    HS: { email: settings.HS_EMAIL, name: settings.HS_ADMIN },
    MS: { email: settings.MS_EMAIL, name: settings.MS_ADMIN },
    IS: { email: settings.IS_EMAIL, name: settings.IS_ADMIN },
    FL: { email: settings.FL_EMAIL, name: settings.FL_ADMIN },
    ECC: { email: settings.ECC_EMAIL, name: settings.ECC_ADMIN }
  };

  return contactsByBuilding[building] || { email: settings.DISTRICT_EMAIL || 'ofcsdistrict@ofcs.net', name: 'Admin' };
}

/**
 * Gets everything pending at the signed-in admin's level (building queue, district queue, or both for super admin)
 * @returns {string} JSON string: { success, submissions, ctx }
 */
function getPendingForMe() {
  try {
    var ctx = getDashboardContext();
    if (!ctx.authorized) {
      return JSON.stringify({ success: false, message: 'Not authorized.' });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Submissions');
    var columnMapping = getColumnMapping(sheet);
    var data = sheet.getDataRange().getValues();

    var results = [];
    for (var i = 1; i < data.length; i++) {
      var rowObj = rowToObject(data[i], columnMapping);

      if (rowObj.status === STATUS_VALUES.PENDING_DISTRICT && ctx.isDistrict) {
        results.push(rowObj);
      } else if (rowObj.status === STATUS_VALUES.PENDING_BUILDING && canActOnBuildingStage(ctx, rowObj.building)) {
        results.push(rowObj);
      }
    }

    results.sort(function (a, b) { return a.submission_number - b.submission_number; });

    return JSON.stringify({ success: true, submissions: results });
  } catch (error) {
    Logger.log('getPendingForMe error: ' + error);
    return JSON.stringify({ success: false, message: 'An error occurred loading pending applications.' });
  }
}

/**
 * Gets the calendar year a trip falls in, from a trip_date that may come back
 * from the sheet as either a real Date object or a "YYYY-MM-DD" string
 * @param {Date|string} tripDate - The trip date
 * @returns {number|null} Four-digit year, or null if it can't be determined
 */
function getTripYear(tripDate) {
  if (!tripDate) return null;
  if (tripDate instanceof Date) return tripDate.getFullYear();
  var parts = String(tripDate).split('-');
  return parts.length ? parseInt(parts[0], 10) : null;
}

/**
 * Gets submission history scoped to the signed-in admin, with status/building/year/text filters
 * @param {string} filterJson - JSON string: { status, building, search, year, scope }
 *   scope: 'current' (default) reads Submissions (everything since the ARCHIVE_CUTOFF_DATE
 *   rewrite went live); 'archive' reads Archives (pre-cutover legacy trips, year-filterable)
 * @returns {string} JSON string: { success, submissions, years }
 */
function getHistory(filterJson) {
  try {
    var ctx = getDashboardContext();
    if (!ctx.authorized) {
      return JSON.stringify({ success: false, message: 'Not authorized.' });
    }

    var filter = JSON.parse(filterJson || '{}');
    var statusFilter = filter.status || 'All';
    var buildingFilter = filter.building || '';
    var searchText = String(filter.search || '').trim().toLowerCase();
    var yearFilter = filter.year || 'All';
    var scope = filter.scope === 'archive' ? 'archive' : 'current';

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(scope === 'archive' ? 'Archives' : 'Submissions');

    var results = [];
    var yearsSeen = {};

    if (sheet) {
      var columnMapping = getColumnMapping(sheet);
      var data = sheet.getDataRange().getValues();

      for (var i = 1; i < data.length; i++) {
        var rowObj = rowToObject(data[i], columnMapping);

        if (!ctx.isDistrict && !ctx.isSuper && ctx.buildings.indexOf(rowObj.building) === -1) {
          continue;
        }

        // Collected before the year filter is applied, so the year picker always
        // lists every year this admin can see, regardless of which one is selected
        var rowYear = getTripYear(rowObj.trip_date);
        if (rowYear) {
          yearsSeen[rowYear] = true;
        }

        // Only Archives is year-filterable - Current is just "everything since cutover"
        if (scope === 'archive' && yearFilter !== 'All' && String(rowYear) !== String(yearFilter)) {
          continue;
        }

        if (statusFilter !== 'All' && rowObj.status !== statusFilter) {
          continue;
        }

        if (buildingFilter && rowObj.building !== buildingFilter) {
          continue;
        }

        if (searchText) {
          var haystack = [rowObj.destination, rowObj.adult_in_charge, rowObj.email, String(rowObj.submission_number)]
            .join(' ').toLowerCase();
          if (haystack.indexOf(searchText) === -1) {
            continue;
          }
        }

        results.push(rowObj);
      }
    }

    results.sort(function (a, b) { return b.submission_number - a.submission_number; });

    var years = Object.keys(yearsSeen).sort(function (a, b) { return b - a; });

    return JSON.stringify({ success: true, submissions: results, years: years });
  } catch (error) {
    Logger.log('getHistory error: ' + error);
    return JSON.stringify({ success: false, message: 'An error occurred loading history.' });
  }
}

/**
 * Bulk approves or rejects a batch of submissions, delegating each row to the existing
 * single-item approveBuildingAdmin/approveDistrictAdmin so email/doMerge/calendar
 * side effects stay identical to a normal single-item approval
 * @param {string} payloadJson - JSON string: { submissionNumbers: [...], action: 'approve'|'reject', comments }
 * @returns {Object} { success, results: [{id, success, message}, ...] }
 */
function bulkProcessSubmissions(payloadJson) {
  try {
    var ctx = getDashboardContext();
    if (!ctx.authorized) {
      return { success: false, message: 'Not authorized.' };
    }

    var payload = JSON.parse(payloadJson);
    var ids = payload.submissionNumbers || [];
    var action = payload.action;
    var comments = sanitizeInput(payload.comments || '');

    if (action !== 'approve' && action !== 'reject') {
      return { success: false, message: 'Invalid action.' };
    }

    if (!ids.length) {
      return { success: false, message: 'No submissions selected.' };
    }

    if (ids.length > BULK_ACTION_LIMIT) {
      return { success: false, message: 'Select ' + BULK_ACTION_LIMIT + ' or fewer at a time.' };
    }

    var results = [];

    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];

      try {
        var submission = findSubmission(id);

        if (!submission) {
          results.push({ id: id, success: false, message: 'Submission not found or already processed.' });
          continue;
        }

        var status = submission.dataObject.status;
        var authorizedForRow = false;

        if (status === STATUS_VALUES.PENDING_BUILDING) {
          authorizedForRow = canActOnBuildingStage(ctx, submission.dataObject.building);
        } else if (status === STATUS_VALUES.PENDING_DISTRICT) {
          authorizedForRow = canActOnDistrictStage(ctx);
        }

        if (!authorizedForRow) {
          results.push({ id: id, success: false, message: 'Not authorized for this submission.' });
          continue;
        }

        var approvalPayload = JSON.stringify({ submission_number: id, action: action, comments: comments });
        var response;

        if (status === STATUS_VALUES.PENDING_BUILDING) {
          response = approveBuildingAdmin(approvalPayload);
        } else {
          response = approveDistrictAdmin(approvalPayload);
        }

        results.push({ id: id, success: response.success, message: response.message });
      } catch (rowError) {
        Logger.log('bulkProcessSubmissions row error for ' + id + ': ' + rowError);
        results.push({ id: id, success: false, message: 'An error occurred processing this submission.' });
      }
    }

    return { success: true, results: results };
  } catch (error) {
    Logger.log('bulkProcessSubmissions error: ' + error);
    return { success: false, message: 'An error occurred processing the batch.' };
  }
}

/**
 * Super-admin-only: creates a trip directly, optionally fast-forwarding past the normal
 * workflow to a chosen starting status (e.g. backfilling a trip that already happened)
 * @param {string} formDataJson - JSON string of form fields plus initialStatus and notify
 * @returns {Object} { success, submissionNumber } or { success:false, message/errors }
 */
function adminCreateSubmission(formDataJson) {
  try {
    var ctx = getDashboardContext();
    if (!ctx.isSuper) {
      return { success: false, message: 'Only a super admin can create a trip directly.' };
    }

    var rawData = JSON.parse(formDataJson);
    var initialStatus = rawData.initialStatus || STATUS_VALUES.PENDING_BUILDING;
    var notify = !!rawData.notify;
    delete rawData.initialStatus;
    delete rawData.notify;

    var validStatuses = [STATUS_VALUES.PENDING_BUILDING, STATUS_VALUES.PENDING_DISTRICT, STATUS_VALUES.APPROVED, STATUS_VALUES.REJECTED];
    if (validStatuses.indexOf(initialStatus) === -1) {
      return { success: false, message: 'Invalid starting status.' };
    }

    var sanitized = sanitizeFormData(rawData);
    var validation = validateFormData(sanitized, { allowPastTripDate: true });

    if (!validation.isValid) {
      var errorMessages = validation.errors.map(function (e) { return e.message; });
      return { success: false, message: 'Validation errors: ' + errorMessages.join(', '), errors: validation.errors };
    }

    // Always lands as Pending Building Approval first - reuses the same append logic
    // (locking, day-of-week, time formatting) the real teacher-facing form relies on
    var submissionNumber = appendSubmission(sanitized);
    var settings = getSettings();
    var now = new Date();

    if (initialStatus === STATUS_VALUES.PENDING_BUILDING) {
      if (notify) {
        var contact = getBuildingAdminContact(settings, sanitized.building);
        sendBuildingAdminNotification(submissionNumber, sanitized, contact.email, contact.name);
      }
      return { success: true, submissionNumber: submissionNumber };
    }

    updateSubmission(submissionNumber, {
      status: STATUS_VALUES.PENDING_DISTRICT,
      building_approval_date: now,
      building_comments: 'Created by admin'
    });

    if (initialStatus === STATUS_VALUES.PENDING_DISTRICT) {
      if (notify) {
        sendDistrictAdminNotification(submissionNumber, sanitized, '', settings.DISTRICT_EMAIL);
      }
      return { success: true, submissionNumber: submissionNumber };
    }

    if (initialStatus === STATUS_VALUES.REJECTED) {
      updateSubmission(submissionNumber, { status: STATUS_VALUES.REJECTED });
      if (notify) {
        sendRejectionEmail(sanitized, '', 'District Administrator');
      }
      return { success: true, submissionNumber: submissionNumber };
    }

    // initialStatus === Approved - generate the approval doc, matching what a real
    // district approval does. No calendar event for backfilled/past trips: see
    // CalendarAdd.js's known argument-mismatch bug, intentionally not touched here.
    updateSubmission(submissionNumber, {
      status: STATUS_VALUES.APPROVED,
      district_approval_date: now
    });

    if (settings.DESTINATION_FOLDER_ID && settings.TEMPLATE_ID) {
      try {
        var approvalDoc = doMerge(submissionNumber, sanitized.adult_in_charge, settings.DESTINATION_FOLDER_ID, settings.SPREADSHEET_ID, settings.TEMPLATE_ID);
        if (approvalDoc) {
          updateSubmission(submissionNumber, { approval_doc_url: approvalDoc.getUrl() });
        }
      } catch (pdfError) {
        Logger.log('adminCreateSubmission doMerge error: ' + pdfError);
      }
    }

    if (notify) {
      sendFinalApprovalEmail(sanitized, '', null);
    }

    return { success: true, submissionNumber: submissionNumber };
  } catch (error) {
    Logger.log('adminCreateSubmission error: ' + error);
    return { success: false, message: 'An unexpected error occurred creating the trip.' };
  }
}

/**
 * Super-admin-only: edits any field on a trip regardless of status. Archives (pre-cutover
 * legacy history) isn't editable here - only current trips in Submissions.
 * @param {number} submissionNumber - The submission to edit
 * @param {string} updatesJson - JSON string of field updates
 * @returns {Object} { success }
 */
function adminEditSubmission(submissionNumber, updatesJson) {
  try {
    var ctx = getDashboardContext();
    if (!ctx.isSuper) {
      return { success: false, message: 'Only a super admin can edit a trip directly.' };
    }

    var submission = findSubmission(submissionNumber);

    if (!submission) {
      return { success: false, message: 'Submission not found.' };
    }

    var updates = sanitizeFormData(JSON.parse(updatesJson));

    // Mirror appendSubmission's conventions so an edited row stays consistent with one
    // that went through the normal form: times stored 12-hour, day_of_week derived from date
    var timeFields = ['leave_school', 'arrive_destination', 'leave_destination', 'arrive_school'];
    for (var t = 0; t < timeFields.length; t++) {
      if (updates[timeFields[t]]) {
        updates[timeFields[t]] = formatTimeTo12Hour(updates[timeFields[t]]);
      }
    }

    if (updates.trip_date) {
      var dateParts = updates.trip_date.split('-');
      var tripDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
      var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      updates.day_of_week = days[tripDate.getDay()];
    }

    updateSubmission(submissionNumber, updates);

    return { success: true };
  } catch (error) {
    Logger.log('adminEditSubmission error: ' + error);
    return { success: false, message: 'An error occurred updating the trip.' };
  }
}

/**
 * Super-admin-only: generates (or regenerates) the official merged Doc for a trip so it can
 * be opened and printed. Works on pending trips too, since it's all one Submissions sheet.
 * @param {number} submissionNumber - The submission to print
 * @returns {Object} { success, url }
 */
function adminPrintSubmission(submissionNumber) {
  try {
    var ctx = getDashboardContext();
    if (!ctx.isSuper) {
      return { success: false, message: 'Only a super admin can print a trip from the dashboard.' };
    }

    var submission = findSubmission(submissionNumber);
    if (!submission) {
      return { success: false, message: 'Submission not found.' };
    }

    var settings = getSettings();
    if (!settings.DESTINATION_FOLDER_ID || !settings.TEMPLATE_ID) {
      return { success: false, message: 'Document template is not configured in Settings.' };
    }

    var doc = doMerge(submissionNumber, submission.dataObject.adult_in_charge, settings.DESTINATION_FOLDER_ID, settings.SPREADSHEET_ID, settings.TEMPLATE_ID);

    if (!doc) {
      return { success: false, message: 'Unable to generate the document.' };
    }

    return { success: true, url: doc.getUrl() };
  } catch (error) {
    Logger.log('adminPrintSubmission error: ' + error);
    return { success: false, message: 'An error occurred generating the document.' };
  }
}
