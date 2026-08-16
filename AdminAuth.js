/**
 * Admin Dashboard Authentication
 * Looks up the signed-in Google account against the _Admins roster sheet
 */

var ADMINS_SHEET = '_Admins';
var ADMINS_CACHE_TTL = 900;
var ADMIN_ROLES = {
  BUILDING: 'building',
  DISTRICT: 'district',
  SUPER: 'super',
  // Lunch roles are intentionally separate from isAdmin below - they grant
  // access to the Lunch Dashboard only, never to the trip-approval dashboard
  LUNCH: 'lunch',
  LUNCH_DISTRICT: 'lunch_district'
};

/**
 * Gets (or creates) the _Admins sheet with its header row
 * @returns {Sheet} The _Admins sheet
 */
function getAdminsSheet() {
  var spreadsheet = getAppSpreadsheet();
  var sheet = spreadsheet.getSheetByName(ADMINS_SHEET);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(ADMINS_SHEET);
    sheet.getRange(1, 1, 1, 5).setValues([['Email', 'Role', 'Building', 'Name', 'Active']]);
  }

  return sheet;
}

/**
 * Gets the _Admins roster, cached the same way getSettings() caches _Settings
 * (see CodeNew.js) - getDashboardContext() runs this on every single dashboard
 * RPC, so reading the sheet fresh every time was a real, repeated cost.
 * Cache is invalidated by addAdminRow/setAdminRowActive (SettingsHandlers.js)
 * whenever the roster is written.
 * @returns {Object[]} [{ email (lowercased), role, building, name, active }, ...]
 */
function getAdminsRoster() {
  var roster = cache.get('_admins_roster');

  if (roster == undefined) {
    var data = getAdminsSheet().getDataRange().getValues();
    roster = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      roster.push({
        email: String(row[0] || '').trim().toLowerCase(),
        role: String(row[1] || '').trim().toLowerCase(),
        building: String(row[2] || '').trim(),
        name: String(row[3] || ''),
        active: row[4] === true || String(row[4]).trim().toUpperCase() === 'TRUE'
      });
    }

    cache.put('_admins_roster', roster, ADMINS_CACHE_TTL);
  }

  return roster;
}

/**
 * Looks up every admin role granted to an email address
 * @param {string} email - Google account email of the visitor
 * @returns {Object} { isAdmin, isSuper, isDistrict, buildings, isLunch, isLunchDistrict, lunchBuildings, name }
 */
function getAdminContext(email) {
  var normalizedEmail = String(email || '').trim().toLowerCase();
  var context = {
    isAdmin: false,
    isSuper: false,
    isDistrict: false,
    buildings: [],
    isLunch: false,
    isLunchDistrict: false,
    lunchBuildings: [],
    name: ''
  };

  if (!normalizedEmail) {
    return context;
  }

  var roster = getAdminsRoster();

  for (var i = 0; i < roster.length; i++) {
    var row = roster[i];

    if (row.email !== normalizedEmail || !row.active) {
      continue;
    }

    context.name = context.name || row.name;

    // isAdmin gates the trip-approval dashboard (?dashboard=1) - only the three
    // trip-approval roles satisfy it. Lunch roles are handled entirely separately
    // below so a lunch-only grant can never reach the trip-approval dashboard.
    if (row.role === ADMIN_ROLES.SUPER) {
      context.isAdmin = true;
      context.isSuper = true;
    } else if (row.role === ADMIN_ROLES.DISTRICT) {
      context.isAdmin = true;
      context.isDistrict = true;
    } else if (row.role === ADMIN_ROLES.BUILDING && row.building) {
      context.isAdmin = true;
      if (context.buildings.indexOf(row.building) === -1) {
        context.buildings.push(row.building);
      }
    } else if (row.role === ADMIN_ROLES.LUNCH_DISTRICT) {
      context.isLunch = true;
      context.isLunchDistrict = true;
    } else if (row.role === ADMIN_ROLES.LUNCH && row.building) {
      context.isLunch = true;
      if (context.lunchBuildings.indexOf(row.building) === -1) {
        context.lunchBuildings.push(row.building);
      }
    }
  }

  if (context.isSuper) {
    context.isDistrict = true;
    // Super admins oversee everything, including the Lunch Dashboard - they
    // shouldn't need a separate lunch_district grant just to get in and set up
    // lunch options/emails or grant lunch roles to actual Food Services Department Staff.
    context.isLunch = true;
    context.isLunchDistrict = true;
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

/**
 * Checks whether an admin context can see/act on a given building's lunch data
 * on the Lunch Dashboard - mirrors canActOnBuildingStage's shape
 * @param {Object} ctx - Result of getDashboardContext()
 * @param {string} building - Building code of the submission being viewed
 * @returns {boolean}
 */
function canActOnLunch(ctx, building) {
  return ctx.isLunchDistrict || ctx.lunchBuildings.indexOf(building) !== -1;
}
