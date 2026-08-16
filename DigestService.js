/**
 * Digest Notifications
 * For buildings (and, mirroring buildings, the district admin) set to 'digest' mode
 * (Settings tab, super-admin only - see SettingsHandlers.js), the per-submission
 * notification (sendBuildingAdminNotification / sendDistrictAdminNotification) is
 * skipped (FormHandlers.js) and this rollup runs once a day instead.
 */

/**
 * Emails each digest-mode building admin a single rollup of everything still
 * awaiting their building-level approval, and the district admin (if also set to
 * digest) a rollup of everything awaiting district-level approval. Run once a day
 * via a time-based trigger - see createDailyDigestTrigger() below for one-time setup.
 */
function sendDailyDigests() {
  // No admin is watching a trigger run in real time, so unlike the RPCs elsewhere
  // in the app, this whole function has to catch its own failures - an uncaught
  // exception here just means every digest-mode building silently gets no email
  // that day, with nobody finding out until someone asks where their trips went.
  try {
    var settings = getSettings();
    var sheet = getAppSpreadsheet().getSheetByName('Submissions');
    var columnMapping = getColumnMapping(sheet);
    var data = sheet.getDataRange().getValues();

    var pendingByBuilding = {};
    var pendingDistrict = [];
    for (var i = 1; i < data.length; i++) {
      var rowObj = rowToObject(data[i], columnMapping);

      if (rowObj.status === STATUS_VALUES.PENDING_BUILDING) {
        if (!pendingByBuilding[rowObj.building]) {
          pendingByBuilding[rowObj.building] = [];
        }
        pendingByBuilding[rowObj.building].push(rowObj);
      } else if (rowObj.status === STATUS_VALUES.PENDING_DISTRICT) {
        pendingDistrict.push(rowObj);
      }
    }

    FORM_SCHEMA.building.options.forEach(function (code) {
      var mode = settings[code + '_NOTIFY_MODE'] || 'instant';
      if (mode !== 'digest') return;

      var pending = pendingByBuilding[code] || [];
      if (!pending.length) return;

      var adminEmail = settings[code + '_EMAIL'];
      var adminName = settings[code + '_ADMIN'] || 'Admin';
      if (!adminEmail) return;

      sendBuildingDigestEmail(adminEmail, adminName, code, pending);
    });

    var districtMode = settings.DISTRICT_NOTIFY_MODE || 'instant';
    if (districtMode === 'digest' && pendingDistrict.length && settings.DISTRICT_EMAIL) {
      sendDistrictDigestEmail(settings.DISTRICT_EMAIL, settings.DISTRICT_ADMIN || 'Admin', pendingDistrict);
    }
  } catch (error) {
    Logger.log('sendDailyDigests error: ' + error);
    notifySystemError('sendDailyDigests', error);
  }
}

/**
 * Sends one rollup email listing every trip awaiting building approval
 * @param {string} adminEmail - Building admin's email
 * @param {string} adminName - Building admin's name
 * @param {string} building - Building code, for the subject line
 * @param {Object[]} pending - dataObjects still Pending Building Approval
 */
function sendBuildingDigestEmail(adminEmail, adminName, building, pending) {
  var dashboardUrl = ScriptApp.getService().getUrl() + '?dashboard=1';

  var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">';
  htmlBody += '<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">';
  htmlBody += '<h1 style="margin: 0;">Field Trips Awaiting Your Review</h1>';
  htmlBody += '</div>';

  htmlBody += '<div style="padding: 20px; background: #f8f9fa;">';
  htmlBody += '<p>Dear ' + adminName + ',</p>';
  htmlBody += '<p>' + pending.length + ' field trip application' + (pending.length === 1 ? '' : 's') +
    ' at your building ' + (pending.length === 1 ? 'is' : 'are') + ' still awaiting your review.</p>';

  htmlBody += '<table style="width: 100%; border-collapse: collapse;">';
  htmlBody += '<tr>' +
    '<th style="text-align:left; padding: 8px; border-bottom: 2px solid #667eea;">#</th>' +
    '<th style="text-align:left; padding: 8px; border-bottom: 2px solid #667eea;">Destination</th>' +
    '<th style="text-align:left; padding: 8px; border-bottom: 2px solid #667eea;">Date</th>' +
    '<th style="text-align:left; padding: 8px; border-bottom: 2px solid #667eea;">Teacher</th>' +
    '</tr>';

  pending.forEach(function (s) {
    htmlBody += '<tr>' +
      '<td style="padding: 8px;">' + s.submission_number + '</td>' +
      '<td style="padding: 8px;">' + s.destination + '</td>' +
      '<td style="padding: 8px;">' + formatEmailDate(s.trip_date) + '</td>' +
      '<td style="padding: 8px;">' + s.adult_in_charge + '</td>' +
      '</tr>';
  });

  htmlBody += '</table>';
  htmlBody += '</div>';

  htmlBody += '<div style="text-align: center; margin: 30px 0;">';
  htmlBody += '<a href="' + dashboardUrl + '" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">Review in Dashboard</a>';
  htmlBody += '</div>';
  htmlBody += '</div>';

  htmlBody += '<div style="background: #e9ecef; padding: 15px; text-align: center; font-size: 12px; color: #6c757d;">';
  htmlBody += '<p>Owen D. Young Central School District - Field Trip Management System</p>';
  htmlBody += '</div>';
  htmlBody += '</div>';

  try {
    MailApp.sendEmail({
      to: adminEmail,
      subject: pending.length + ' Field Trip Application' + (pending.length === 1 ? '' : 's') + ' Awaiting Review - ' + building,
      htmlBody: htmlBody
    });
  } catch (error) {
    Logger.log('Error sending digest email for ' + building + ': ' + error);
    notifySystemError('sendBuildingDigestEmail (' + building + ')', error);
  }
}

/**
 * Sends one rollup email to the district admin listing every trip (across all
 * buildings) awaiting district approval - mirrors sendBuildingDigestEmail, but
 * includes a Building column since these span every building.
 * @param {string} adminEmail - District admin's email
 * @param {string} adminName - District admin's name
 * @param {Object[]} pending - dataObjects still Pending District Approval
 */
function sendDistrictDigestEmail(adminEmail, adminName, pending) {
  var dashboardUrl = ScriptApp.getService().getUrl() + '?dashboard=1';

  var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">';
  htmlBody += '<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">';
  htmlBody += '<h1 style="margin: 0;">Field Trips Awaiting Your Review</h1>';
  htmlBody += '</div>';

  htmlBody += '<div style="padding: 20px; background: #f8f9fa;">';
  htmlBody += '<p>Dear ' + adminName + ',</p>';
  htmlBody += '<p>' + pending.length + ' field trip application' + (pending.length === 1 ? '' : 's') +
    ' district-wide ' + (pending.length === 1 ? 'is' : 'are') + ' still awaiting district review.</p>';

  htmlBody += '<table style="width: 100%; border-collapse: collapse;">';
  htmlBody += '<tr>' +
    '<th style="text-align:left; padding: 8px; border-bottom: 2px solid #667eea;">#</th>' +
    '<th style="text-align:left; padding: 8px; border-bottom: 2px solid #667eea;">Building</th>' +
    '<th style="text-align:left; padding: 8px; border-bottom: 2px solid #667eea;">Destination</th>' +
    '<th style="text-align:left; padding: 8px; border-bottom: 2px solid #667eea;">Date</th>' +
    '<th style="text-align:left; padding: 8px; border-bottom: 2px solid #667eea;">Teacher</th>' +
    '</tr>';

  pending.forEach(function (s) {
    htmlBody += '<tr>' +
      '<td style="padding: 8px;">' + s.submission_number + '</td>' +
      '<td style="padding: 8px;">' + s.building + '</td>' +
      '<td style="padding: 8px;">' + s.destination + '</td>' +
      '<td style="padding: 8px;">' + formatEmailDate(s.trip_date) + '</td>' +
      '<td style="padding: 8px;">' + s.adult_in_charge + '</td>' +
      '</tr>';
  });

  htmlBody += '</table>';
  htmlBody += '</div>';

  htmlBody += '<div style="text-align: center; margin: 30px 0;">';
  htmlBody += '<a href="' + dashboardUrl + '" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">Review in Dashboard</a>';
  htmlBody += '</div>';
  htmlBody += '</div>';

  htmlBody += '<div style="background: #e9ecef; padding: 15px; text-align: center; font-size: 12px; color: #6c757d;">';
  htmlBody += '<p>Owen D. Young Central School District - Field Trip Management System</p>';
  htmlBody += '</div>';
  htmlBody += '</div>';

  try {
    MailApp.sendEmail({
      to: adminEmail,
      subject: pending.length + ' Field Trip Application' + (pending.length === 1 ? '' : 's') + ' Awaiting District Review',
      htmlBody: htmlBody
    });
  } catch (error) {
    Logger.log('Error sending district digest email: ' + error);
    notifySystemError('sendDistrictDigestEmail', error);
  }
}

/**
 * One-time setup: installs the daily trigger that calls sendDailyDigests().
 * Run this once from the Apps Script editor (select this function in the
 * function dropdown, then click Run) - not something clasp push can install,
 * since triggers live in the deployment's trigger config, not in source.
 * Safe to re-run: it removes any existing sendDailyDigests trigger first, so
 * it never creates duplicates.
 */
function createDailyDigestTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'sendDailyDigests') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('sendDailyDigests')
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .inTimezone(Session.getScriptTimeZone())
    .create();

  Logger.log('Daily digest trigger installed - sendDailyDigests will run once a day, around 6am.');
}

/**
 * Reminds the submitting teacher to enter school lunch counts as the trip date
 * approaches, if they haven't already. Runs once a day via a time-based trigger -
 * see createLunchReminderTrigger() below for one-time setup. Fires once per trip
 * (lunch_reminder_sent_date dedupes it), not daily, once inside the window.
 */
var LUNCH_REMINDER_WINDOW_DAYS = 10;

function sendLunchCountReminders() {
  // Same reasoning as sendDailyDigests above - this only ever runs unattended via
  // trigger, so it has to catch its own failures or a broken run just means every
  // teacher who needed a reminder that day silently never gets one.
  try {
    var sheet = getAppSpreadsheet().getSheetByName('Submissions');
    var columnMapping = getColumnMapping(sheet);
    var data = sheet.getDataRange().getValues();

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    for (var i = 1; i < data.length; i++) {
      var rowObj = rowToObject(data[i], columnMapping);

      if (rowObj.lunch_status !== LUNCH_STATUS_VALUES.AWAITING_COUNTS || rowObj.lunch_reminder_sent_date) {
        continue;
      }

      var tripDate = rowObj.trip_date instanceof Date ? rowObj.trip_date : new Date(rowObj.trip_date);
      if (isNaN(tripDate)) {
        continue;
      }
      tripDate.setHours(0, 0, 0, 0);

      var daysUntilTrip = Math.round((tripDate - today) / (1000 * 60 * 60 * 24));
      if (daysUntilTrip <= 0 || daysUntilTrip > LUNCH_REMINDER_WINDOW_DAYS) {
        continue;
      }

      sendLunchCountReminderEmail(rowObj);
      updateSubmission(rowObj.submission_number, { lunch_reminder_sent_date: new Date() });
    }
  } catch (error) {
    Logger.log('sendLunchCountReminders error: ' + error);
    notifySystemError('sendLunchCountReminders', error);
  }
}

/**
 * One-time setup: installs the daily trigger that calls sendLunchCountReminders().
 * Same manual-per-project install caveat as createDailyDigestTrigger above - run
 * once from the Apps Script editor, not something clasp push installs. Safe to
 * re-run: removes any existing sendLunchCountReminders trigger first.
 */
function createLunchReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'sendLunchCountReminders') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('sendLunchCountReminders')
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .inTimezone(Session.getScriptTimeZone())
    .create();

  Logger.log('Lunch reminder trigger installed - sendLunchCountReminders will run once a day, around 6am.');
}
