/**
 * Main Application Controller - Modernized Version
 * Routes requests and serves appropriate interfaces
 */

var CACHE_PROP = CacheService.getPublicCache();
var ss = getAppSpreadsheet();
var SETTINGS_SHEET = "_Settings";
var CACHE_SETTINGS = true;
var SETTINGS_CACHE_TTL = 900;
var cache = JSONCacheService();
var SETTINGS = getSettings();

/**
 * Returns the spreadsheet this app reads/writes. Normally the project's own
 * container-bound spreadsheet (how dev works today) - but if this project's
 * Script Properties has APP_SPREADSHEET_ID set, that spreadsheet is used
 * instead. This lets a project keep its existing container binding (and web
 * app URL) while actually operating on a different spreadsheet - see
 * CLAUDE.md's "Flipping the switch to production" section.
 * @returns {Spreadsheet}
 */
function getAppSpreadsheet() {
  var overrideId = PropertiesService.getScriptProperties().getProperty('APP_SPREADSHEET_ID');
  return overrideId ? SpreadsheetApp.openById(overrideId) : SpreadsheetApp.getActiveSpreadsheet();
}

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

  var action = e.parameter.action;
  var idVal = e.parameter.idNum;
  var template;

  // Emailed review links carry ?action=<key> instead of magic numbers;
  // each entry maps the pending status to check against the template to render,
  // plus who is allowed to act at that stage (same rules as the dashboard RPCs).
  var REVIEW_ACTIONS = {
    buildingReview: {
      pendingStatus: STATUS_VALUES.PENDING_BUILDING,
      templateFile: "BuildingAdminNew.html",
      canAct: function (ctx, submission) {
        return canActOnBuildingStage(ctx, submission.dataObject.building);
      }
    },
    districtReview: {
      pendingStatus: STATUS_VALUES.PENDING_DISTRICT,
      templateFile: "DistrictAdminNew.html",
      canAct: function (ctx, submission) {
        return canActOnDistrictStage(ctx);
      }
    }
  };

  try {
    if (REVIEW_ACTIONS.hasOwnProperty(action)) {
      var reviewAction = REVIEW_ACTIONS[action];
      var submission = findSubmission(idVal);

      if (!submission || submission.dataObject.status !== reviewAction.pendingStatus) {
        template = HtmlService.createTemplateFromFile("DoneAlready.html");
      } else {
        // The link itself carries no proof of identity - require the visitor to
        // actually be the admin (or higher) authorized for this submission's stage,
        // same as if they'd reached it through the dashboard.
        var reviewCtx = getAdminContext(Session.getActiveUser().getEmail());
        if (!reviewCtx.isAdmin || !reviewAction.canAct(reviewCtx, submission)) {
          template = HtmlService.createTemplateFromFile("NotAuthorized.html");
        } else {
          template = HtmlService.createTemplateFromFile(reviewAction.templateFile);
          template.info = submission.dataObject;
        }
      }

    } else if (e.parameter.checkStatus == '1') {
      // Teacher self-service status lookup - always the signed-in visitor's own
      // email, never a free-typed one, so this can't be used to look up anyone else's
      template = HtmlService.createTemplateFromFile("StatusLookup.html");
      template.userEmail = Session.getActiveUser().getEmail();

    } else if (e.parameter.dashboard == '1') {
      // Admin dashboard - role is derived from the signed-in Google account, never from a URL param
      var dashboardCtx = getAdminContext(Session.getActiveUser().getEmail());

      if (!dashboardCtx.isAdmin) {
        template = HtmlService.createTemplateFromFile("NotAuthorized.html");
      } else {
        template = HtmlService.createTemplateFromFile("AdminDashboardNew.html");
        template.ctx = dashboardCtx;
      }

    } else {
      // Main Form
      template = HtmlService.createTemplateFromFile("FormNew.html");
      template.formFields = getUserFormFields();
      template.timeSequence = TIME_SEQUENCE_FIELDS;
      // Pre-fills the Email field client-side (typo prevention) - not enforced,
      // a teacher can still change it to submit under a different address
      template.userEmail = Session.getActiveUser().getEmail();
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
    if(payload === null || payload === undefined) {
      return undefined;
    }
    return JSON.parse(payload);
  }

  var put = function(k, d, t) {
    _cache.put(_key_prefix+k, JSON.stringify(d), t);
  }

  var remove = function(k) {
    _cache.remove(_key_prefix+k);
  }

  return {
    'get': get,
    'put': put,
    'remove': remove
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
