/**
 * Admin Dashboard Authentication
 * Looks up the signed-in Google account against the _Admins roster sheet
 */

var ADMINS_SHEET = '_Admins';
var ADMIN_ROLES = {
  BUILDING: 'building',
  DISTRICT: 'district',
  SUPER: 'super'
};

/**
 * Gets (or creates) the _Admins sheet with its header row
 * @returns {Sheet} The _Admins sheet
 */
function getAdminsSheet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(ADMINS_SHEET);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(ADMINS_SHEET);
    sheet.getRange(1, 1, 1, 5).setValues([['Email', 'Role', 'Building', 'Name', 'Active']]);
  }

  return sheet;
}

/**
 * Looks up every admin role granted to an email address
 * @param {string} email - Google account email of the visitor
 * @returns {Object} { isAdmin, isSuper, isDistrict, buildings, name }
 */
function getAdminContext(email) {
  var normalizedEmail = String(email || '').trim().toLowerCase();
  var context = {
    isAdmin: false,
    isSuper: false,
    isDistrict: false,
    buildings: [],
    name: ''
  };

  if (!normalizedEmail) {
    return context;
  }

  var sheet = getAdminsSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowEmail = String(row[0] || '').trim().toLowerCase();
    var rowActive = row[4] === true || String(row[4]).trim().toUpperCase() === 'TRUE';

    if (rowEmail !== normalizedEmail || !rowActive) {
      continue;
    }

    var role = String(row[1] || '').trim().toLowerCase();
    var building = String(row[2] || '').trim();

    context.isAdmin = true;
    context.name = context.name || String(row[3] || '');

    if (role === ADMIN_ROLES.SUPER) {
      context.isSuper = true;
    } else if (role === ADMIN_ROLES.DISTRICT) {
      context.isDistrict = true;
    } else if (role === ADMIN_ROLES.BUILDING && building && context.buildings.indexOf(building) === -1) {
      context.buildings.push(building);
    }
  }

  if (context.isSuper) {
    context.isDistrict = true;
  }

  return context;
}

/**
 * Gets the dashboard authorization context for the currently signed-in visitor
 * @returns {Object} Admin context plus { authorized, email }
 */
function getDashboardContext() {
  var email = Session.getActiveUser().getEmail();
  var context = getAdminContext(email);

  context.authorized = context.isAdmin;
  context.email = email;

  return context;
}

/**
 * Checks whether an admin context can act on a submission still at the building-approval stage
 * Only super admins and the building's own admin can act here - a district admin who
 * isn't also super is not automatically a building admin for every building
 * @param {Object} ctx - Result of getDashboardContext()
 * @param {string} building - Building code of the submission being acted on
 * @returns {boolean}
 */
function canActOnBuildingStage(ctx, building) {
  return ctx.isSuper || ctx.buildings.indexOf(building) !== -1;
}

/**
 * Checks whether an admin context can act on a submission at the district-approval stage
 * District-stage approval was never building-scoped, so any district/super admin can act
 * @param {Object} ctx - Result of getDashboardContext()
 * @returns {boolean}
 */
function canActOnDistrictStage(ctx) {
  return ctx.isDistrict;
}
