/**
 * Data Access Layer
 * Handles all spreadsheet operations with flexible column mapping
 */

/**
 * Formats a time input (HH:mm) to 12-hour format with AM/PM
 * @param {string} timeString - Time in 24-hour format (HH:mm)
 * @returns {string} Time in 12-hour format (h:mm AM/PM)
 */
function formatTimeTo12Hour(timeString) {
  if (!timeString) return '';

  var parts = timeString.split(':');
  if (parts.length !== 2) return timeString;

  var hours = parseInt(parts[0], 10);
  var minutes = parts[1];

  var ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12

  return hours + ':' + minutes + ' ' + ampm;
}

/**
 * Gets or creates column index mapping for a sheet
 * This enables columns to be reordered without breaking the code
 * @param {Sheet} sheet - The sheet to map
 * @returns {Object} Map of column headers to column indices
 */
function getColumnMapping(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var mapping = {};

  for (var i = 0; i < headers.length; i++) {
    var header = String(headers[i]).trim();
    if (header) {
      mapping[header] = i;
    }
  }

  return mapping;
}

/**
 * Ensures all required columns exist in the sheet
 * Creates missing columns automatically
 * @param {Sheet} sheet - The sheet to validate
 */
function ensureColumnsExist(sheet) {
  var currentHeaders = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  var requiredHeaders = getColumnHeaders();
  var headersToAdd = [];

  // Find missing headers
  for (var i = 0; i < requiredHeaders.length; i++) {
    var found = false;
    for (var j = 0; j < currentHeaders.length; j++) {
      if (String(currentHeaders[j]).trim() === requiredHeaders[i]) {
        found = true;
        break;
      }
    }
    if (!found) {
      headersToAdd.push(requiredHeaders[i]);
    }
  }

  // Add missing headers
  if (headersToAdd.length > 0) {
    var lastCol = sheet.getLastColumn();
    var startCol = lastCol + 1;
    sheet.getRange(1, startCol, 1, headersToAdd.length).setValues([headersToAdd]);
    Logger.log('Added ' + headersToAdd.length + ' missing columns: ' + headersToAdd.join(', '));
  }
}

/**
 * Converts a data object to an array based on column headers
 * @param {Object} dataObj - The data object with field keys from FORM_SCHEMA
 * @param {Object} columnMapping - Map of column headers to indices
 * @returns {Array} Array of values in correct column order
 */
function objectToRow(dataObj, columnMapping) {
  var row = [];
  var maxIndex = 0;

  // Find the maximum column index
  for (var header in columnMapping) {
    if (columnMapping[header] > maxIndex) {
      maxIndex = columnMapping[header];
    }
  }

  // Initialize array with empty strings
  for (var i = 0; i <= maxIndex; i++) {
    row[i] = '';
  }

  // Map object values to correct positions
  for (var key in FORM_SCHEMA) {
    var columnHeader = FORM_SCHEMA[key].columnHeader;
    var colIndex = columnMapping[columnHeader];

    if (colIndex !== undefined && dataObj.hasOwnProperty(key)) {
      var value = dataObj[key];

      // Handle arrays (like checkbox groups)
      if (Array.isArray(value)) {
        row[colIndex] = value.join(', ');
      } else {
        row[colIndex] = value;
      }
    }
  }

  return row;
}

/**
 * Converts a spreadsheet row to a data object
 * @param {Array} row - Array of cell values from spreadsheet
 * @param {Object} columnMapping - Map of column headers to indices
 * @returns {Object} Data object with field keys from FORM_SCHEMA
 */
function rowToObject(row, columnMapping) {
  var dataObj = {};

  for (var key in FORM_SCHEMA) {
    var columnHeader = FORM_SCHEMA[key].columnHeader;
    var colIndex = columnMapping[columnHeader];

    if (colIndex !== undefined && row[colIndex] !== undefined) {
      dataObj[key] = row[colIndex];
    }
  }

  return dataObj;
}

/**
 * Appends a new submission to the sheet
 * Uses LockService to prevent data loss from simultaneous submissions
 * @param {Object} formData - The form data object
 * @returns {number} The submission number
 */
function appendSubmission(formData) {
  // Acquire a lock to prevent simultaneous submissions from interfering
  var lock = LockService.getScriptLock();

  try {
    // Wait up to 30 seconds for the lock
    lock.waitLock(30000);

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Submissions');

    // Ensure all columns exist
    ensureColumnsExist(sheet);

    // Get column mapping
    var columnMapping = getColumnMapping(sheet);

    // Add system-generated fields
    var submissionNumber = +new Date();
    var timestamp = new Date();

  // Parse trip date correctly to avoid timezone issues
  // Input format is YYYY-MM-DD, parse it as local date
  var dateParts = formData.trip_date.split('-');
  var tripDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
  var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  formData.submission_number = submissionNumber;
  formData.timestamp = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'MM/dd/yyyy HH:mm:ss');
  formData.status = STATUS_VALUES.PENDING_BUILDING;
  formData.day_of_week = days[tripDate.getDay()];

  // Format times to 12-hour format with AM/PM
  if (formData.leave_school) {
    formData.leave_school = formatTimeTo12Hour(formData.leave_school);
  }
  if (formData.arrive_destination) {
    formData.arrive_destination = formatTimeTo12Hour(formData.arrive_destination);
  }
  if (formData.leave_destination) {
    formData.leave_destination = formatTimeTo12Hour(formData.leave_destination);
  }
  if (formData.arrive_school) {
    formData.arrive_school = formatTimeTo12Hour(formData.arrive_school);
  }

  // Get building admin name from settings
  var settings = getSettings();
  var buildingKey = formData.building + '_ADMIN';
  formData.building_admin = settings[buildingKey] || 'Unknown';

  // Convert object to row array
  var rowData = objectToRow(formData, columnMapping);

  // Append to sheet
  var newRowIndex = sheet.getLastRow() + 1;
  sheet.appendRow(rowData);

  // Force time columns to be plain text to prevent timezone conversion
  var timeColumns = ['Leave_School', 'Arrive_Destination', 'Leave_Destination', 'Arrive_School'];
  for (var i = 0; i < timeColumns.length; i++) {
    var colIndex = columnMapping[timeColumns[i]];
    if (colIndex !== undefined) {
      var cell = sheet.getRange(newRowIndex, colIndex + 1);
      cell.setNumberFormat('@'); // '@' means plain text
    }
  }

    // Force spreadsheet to flush all pending changes before returning
    // This ensures the data is available for immediate reads (like document merge)
    SpreadsheetApp.flush();

    return submissionNumber;

  } catch (e) {
    // Log error and re-throw
    Logger.log('Error in appendSubmission: ' + e);
    throw e;
  } finally {
    // Always release the lock, even if there's an error
    lock.releaseLock();
  }
}

/**
 * Finds a submission by submission number
 * @param {number} submissionNumber - The unique submission number
 * @param {string} sheetName - Name of sheet to search (default: 'Submissions')
 * @returns {Object|null} Object containing row data and row index, or null if not found
 */
function findSubmission(submissionNumber, sheetName) {
  sheetName = sheetName || 'Submissions';
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  if (!sheet) {
    Logger.log('Sheet not found: ' + sheetName);
    return null;
  }

  var columnMapping = getColumnMapping(sheet);
  var submissionColIndex = columnMapping['Submission_Number'];

  if (submissionColIndex === undefined) {
    Logger.log('Submission_Number column not found');
    return null;
  }

  var data = sheet.getDataRange().getValues();

  // Start at row 1 (skip header row 0)
  for (var i = 1; i < data.length; i++) {
    if (data[i][submissionColIndex] == submissionNumber) {
      return {
        rowIndex: i + 1, // +1 because sheet rows are 1-indexed
        rowData: data[i],
        dataObject: rowToObject(data[i], columnMapping)
      };
    }
  }

  return null;
}

/**
 * Updates a submission's status and other fields
 * @param {number} submissionNumber - The submission to update
 * @param {Object} updates - Object containing fields to update
 * @param {string} sheetName - Name of sheet the submission lives in (default: 'Submissions')
 * @returns {boolean} Success status
 */
function updateSubmission(submissionNumber, updates, sheetName) {
  sheetName = sheetName || 'Submissions';
  var submission = findSubmission(submissionNumber, sheetName);

  if (!submission) {
    Logger.log('Submission not found: ' + submissionNumber + ' in ' + sheetName);
    return false;
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  var columnMapping = getColumnMapping(sheet);

  // Update each field
  for (var key in updates) {
    if (FORM_SCHEMA[key]) {
      var columnHeader = FORM_SCHEMA[key].columnHeader;
      var colIndex = columnMapping[columnHeader];

      if (colIndex !== undefined) {
        sheet.getRange(submission.rowIndex, colIndex + 1).setValue(updates[key]);
      }
    }
  }

  return true;
}

/**
 * Moves a submission from Submissions to Completed sheet
 * @param {number} submissionNumber - The submission to move
 * @returns {boolean} Success status
 */
function moveToCompleted(submissionNumber) {
  var submission = findSubmission(submissionNumber);

  if (!submission) {
    Logger.log('Submission not found: ' + submissionNumber);
    return false;
  }

  var submissionsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Submissions');
  var completedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Completed');

  // Ensure completed sheet has same columns
  ensureColumnsExist(completedSheet);

  // Copy row to completed sheet
  var columnMapping = getColumnMapping(submissionsSheet);
  completedSheet.appendRow(submission.rowData);

  // Delete from submissions sheet
  submissionsSheet.deleteRow(submission.rowIndex);

  return true;
}

/**
 * Gets all pending submissions for a specific building
 * @param {string} building - Building code (HS, MS, IS, FL, ECC)
 * @param {string} status - Status to filter by (optional)
 * @returns {Array} Array of submission objects
 */
function getSubmissionsByBuilding(building, status) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Submissions');
  var columnMapping = getColumnMapping(sheet);
  var data = sheet.getDataRange().getValues();

  var buildingColIndex = columnMapping['Building'];
  var statusColIndex = columnMapping['Status'];

  var results = [];

  // Start at row 1 (skip header)
  for (var i = 1; i < data.length; i++) {
    var matchesBuilding = data[i][buildingColIndex] === building;
    var matchesStatus = !status || data[i][statusColIndex] === status;

    if (matchesBuilding && matchesStatus) {
      results.push(rowToObject(data[i], columnMapping));
    }
  }

  return results;
}
