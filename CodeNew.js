/**
 * Main Application Controller - Modernized Version
 * Routes requests and serves appropriate interfaces
 */

var SPREADSHEET_ID = '1vTtLDsUbBeYQVAVlX1658JOjRIigzbFlaY-U0MYViNc';
var CACHE_PROP = CacheService.getPublicCache();
var ss = SpreadsheetApp.getActiveSpreadsheet();
var SETTINGS_SHEET = "_Settings";
var CACHE_SETTINGS = false;
var SETTINGS_CACHE_TTL = 900;
var cache = JSONCacheService();
var SETTINGS = getSettings();

/**
 * Pulls in a shared HTML partial (e.g. vendored CSS) at template-render time.
 * Used via <?!= include('VendorStyles'); ?> in the HTML templates.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Debug function to output raw HTML
 */
function doGet(e) {
  // Debug mode - output raw HTML as text
  if (e.parameter.debug === 'html') {
    try {
      var template = HtmlService.createTemplateFromFile("FormNew.html");
      var html = template.evaluate().getContent();
      return ContentService.createTextOutput(html).setMimeType(ContentService.MimeType.TEXT);
    } catch (error) {
      return ContentService.createTextOutput("Template error: " + error.message + "\n\nStack: " + error.stack);
    }
  }

  var buildingApproved = e.parameter.buildapprove;
  var idVal = e.parameter.idNum;
  var template;

  try {
    if (buildingApproved == 2) {
      // District Admin Review
      var submission = findSubmission(idVal);

      if (!submission || submission.dataObject.status !== STATUS_VALUES.PENDING_DISTRICT) {
        template = HtmlService.createTemplateFromFile("DoneAlready.html");
      } else {
        template = HtmlService.createTemplateFromFile("DistrictAdminNew.html");
        template.info = submission.dataObject;
      }

    } else if (buildingApproved == 1) {
      // Building Admin Review
      var submission = findSubmission(idVal);

      if (!submission || submission.dataObject.status !== STATUS_VALUES.PENDING_BUILDING) {
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

    } else if (e.parameter.checkStatus == '1') {
      // Teacher self-service status lookup
      template = HtmlService.createTemplateFromFile("StatusLookup.html");

    } else if (e.parameter.dashboard == '1') {
      // Admin dashboard of all pending applications
      template = HtmlService.createTemplateFromFile("AdminDashboard.html");

    } else {
      // Main Form
      template = HtmlService.createTemplateFromFile("FormNew.html");
    }

    // Served pages are hosted on a sandboxed content domain, not the /exec URL,
    // so any in-page links back into the app must be absolute, built from this.
    template.webAppUrl = ScriptApp.getService().getUrl();

    var html = template.evaluate();
    var output = HtmlService.createHtmlOutput(html)
      .setTitle("OFCS Field Trip Application");

    return output;

  } catch (error) {
    Logger.log('doGet error: ' + error);
    Logger.log('Error stack: ' + error.stack);
    return ContentService.createTextOutput("An error occurred: " + error.message + ". Please check the execution logs.");
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
 * Get settings from _Settings sheet
 */
function getSettings() {
  if(CACHE_SETTINGS) {
    var settings = cache.get("_settings");
  }

  if(settings == undefined) {
    var sheet = ss.getSheetByName(SETTINGS_SHEET);
    var values = sheet.getDataRange().getValues();

    var settings = {};
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      settings[row[0]] = row[1];
    }

    cache.put("_settings", settings, SETTINGS_CACHE_TTL);
  }
  return settings;
}

/**
 * JSON Cache Service helper
 */
function JSONCacheService() {
  var _cache = CacheService.getPublicCache();
  var _key_prefix = "_json#";

  var get = function(k) {
    var payload = _cache.get(_key_prefix+k);
    if(payload !== undefined) {
      JSON.parse(payload);
    }
    return payload
  }

  var put = function(k, d, t) {
    _cache.put(_key_prefix+k, JSON.stringify(d), t);
  }

  return {
    'get': get,
    'put': put
  }
}

/**
 * Time formatting helper
 */
Number.prototype.toHHMM = function () {
  var hours = Math.floor(this / 100);
  var minutes = (this % 100);
  return hours + ":" + (minutes < 10 ? "0" + minutes : minutes);
};
