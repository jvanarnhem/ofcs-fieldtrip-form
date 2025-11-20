/**
 * Main Application Controller - Modernized Version
 * Routes requests and serves appropriate interfaces
 */

var SPREADSHEET_ID = '1Tuas-Xy8RhpPhQljk5j4W-RTW_c4zUd6aFUNDY13WDI';
var CACHE_PROP = CacheService.getPublicCache();
var ss = SpreadsheetApp.getActiveSpreadsheet();
var SETTINGS_SHEET = "_Settings";
var CACHE_SETTINGS = false;
var SETTINGS_CACHE_TTL = 900;
var cache = JSONCacheService();
var SETTINGS = getSettings();

/**
 * Main doGet handler - routes to appropriate interface
 * @param {Object} e - Event object containing request parameters
 * @returns {HtmlOutput} The appropriate HTML interface
 */
function doGet(e) {
  var buildingApproved = e.parameter.buildapprove;
  var idVal = e.parameter.idNum;
  var template;

  try {
    if (buildingApproved == 2) {
      // District Admin Review
      var submission = findSubmission(idVal);

      if (!submission) {
        return ContentService.createTextOutput("Submission not found or already processed.");
      }

      template = HtmlService.createTemplateFromFile("DistrictAdminNew.html");
      template.info = submission.dataObject;

    } else if (buildingApproved == 1) {
      // Building Admin Review
      var submission = findSubmission(idVal);

      if (!submission) {
        template = HtmlService.createTemplateFromFile("DoneAlready.html");
      } else {
        template = HtmlService.createTemplateFromFile("BuildingAdminNew.html");
        template.info = submission.dataObject;
      }

    } else if (buildingApproved == 0) {
      // Quick reject (legacy support)
      updateSubmission(idVal, {
        status: STATUS_VALUES.REJECTED
      });
      return ContentService.createTextOutput("Application rejected!");

    } else {
      // Main Form
      template = HtmlService.createTemplateFromFile("FormNew.html");
    }

    var html = template.evaluate();
    var output = HtmlService.createHtmlOutput(html)
      .setTitle("OFCS Field Trip Application")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

    return output;

  } catch (error) {
    Logger.log('doGet error: ' + error);
    return ContentService.createTextOutput("An error occurred. Please try again or contact support.");
  }
}

/**
 * Legacy update function - kept for backward compatibility
 * New code should use updateSubmission() from DataLayer.js
 */
function update(submissionNumber, statusCode, comments, docURL) {
  var updates = {};

  switch (statusCode) {
    case 1:
      updates.status = STATUS_VALUES.PENDING_BUILDING;
      break;
    case 2:
      updates.status = STATUS_VALUES.PENDING_DISTRICT;
      updates.building_comments = comments;
      updates.building_approval_date = new Date();
      break;
    case 3:
      updates.status = STATUS_VALUES.APPROVED;
      updates.district_comments = comments;
      updates.district_approval_date = new Date();
      if (docURL) {
        updates.approval_doc_url = docURL;
      }
      break;
    default:
      updates.status = STATUS_VALUES.REJECTED;
      if (comments) {
        updates.district_comments = comments;
      }
  }

  return updateSubmission(submissionNumber, updates);
}

/**
 * Time formatting helper
 */
Number.prototype.toHHMM = function () {
  var hours = Math.floor(this / 100);
  var minutes = (this % 100);
  return hours + ":" + (minutes < 10 ? "0" + minutes : minutes);
};
