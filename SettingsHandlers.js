/**
 * Settings Tab Backend Functions
 * RPC endpoints called from AdminDashboardNew.html's Settings tab: manages the _Settings
 * sheet (known keys only, no free-form additions) and the _Admins roster.
 */

var GLOBAL_SETTINGS_KEYS = ['DESTINATION_FOLDER_ID', 'INITIAL_SUB_FOLDER_ID', 'TEMPLATE_ID',
  'TEMPLATE_INIT_ID', 'CALENDAR_NAME', 'FINAL_EMAIL', 'DISTRICT_EMAIL'];

var BUILDING_SETTINGS_KEYS = {
  HS: ['HS_ADMIN', 'HS_EMAIL'],
  MS: ['MS_ADMIN', 'MS_EMAIL'],
  IS: ['IS_ADMIN', 'IS_EMAIL'],
  FL: ['FL_ADMIN', 'FL_EMAIL'],
  ECC: ['ECC_ADMIN', 'ECC_EMAIL']
};

// Per-building notification mode ('instant' or 'digest') - unlike the settings above,
// this is super-admin-only regardless of building scope (see saveSettings), since it's
// a district-wide policy choice about email volume, not a building's own contact info.
var NOTIFY_MODE_SUFFIX = '_NOTIFY_MODE';
var NOTIFY_MODES = ['instant', 'digest'];

/**
 * Finds which building a _Settings key belongs to, if any
 * @param {string} key - Settings key, e.g. 'HS_EMAIL'
 * @returns {string|null} Building code, or null if it isn't a building-scoped key
 */
function findBuildingForSettingKey(key) {
  for (var code in BUILDING_SETTINGS_KEYS) {
    if (BUILDING_SETTINGS_KEYS[code].indexOf(key) !== -1) {
      return code;
    }
  }
  return null;
}

/**
 * Writes a single key/value pair into the _Settings sheet
 * @param {Sheet} sheet - The _Settings sheet
 * @param {string} key - Setting key (column A)
 * @param {string} value - Setting value (column B)
 */
function setSettingValue(sheet, key, value) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

/**
 * Gets the settings this admin is allowed to see/edit, scoped by role
 * @returns {Object} { success, global, buildings } - global is null for a plain building admin
 */
function getSettingsForDashboard() {
  try {
    var ctx = getDashboardContext();
    if (!ctx.authorized) {
      return { success: false, message: 'Not authorized.' };
    }

    var settings = getSettings();
    var canSeeAll = ctx.isSuper || ctx.isDistrict;

    var global = null;
    if (canSeeAll) {
      global = {};
      GLOBAL_SETTINGS_KEYS.forEach(function (key) {
        global[key] = settings[key] || '';
      });
    }

    var buildingCodes = canSeeAll ? FORM_SCHEMA.building.options : ctx.buildings;
    var buildings = {};
    buildingCodes.forEach(function (code) {
      buildings[code] = {
        admin: settings[code + '_ADMIN'] || '',
        email: settings[code + '_EMAIL'] || '',
        notifyMode: settings[code + NOTIFY_MODE_SUFFIX] || 'instant'
      };
    });

    return { success: true, global: global, buildings: buildings };
  } catch (error) {
    Logger.log('getSettingsForDashboard error: ' + error);
    return { success: false, message: 'An error occurred loading settings.' };
  }
}

/**
 * Saves a batch of settings, skipping any key this admin isn't permitted to touch
 * @param {string} updatesJson - JSON string: flat { KEY: value } map
 * @returns {Object} { success, saved: [keys], skipped: [keys] }
 */
function saveSettings(updatesJson) {
  try {
    var ctx = getDashboardContext();
    if (!ctx.authorized) {
      return { success: false, message: 'Not authorized.' };
    }

    var updates = JSON.parse(updatesJson);
    var canSeeAll = ctx.isSuper || ctx.isDistrict;
    var sheet = getAppSpreadsheet().getSheetByName(SETTINGS_SHEET);

    var saved = [];
    var skipped = [];

    for (var key in updates) {
      var permitted = false;

      if (key.slice(-NOTIFY_MODE_SUFFIX.length) === NOTIFY_MODE_SUFFIX) {
        var modeBuilding = key.slice(0, -NOTIFY_MODE_SUFFIX.length);
        var modeValue = String(updates[key] || '').toLowerCase();
        permitted = ctx.isSuper && FORM_SCHEMA.building.options.indexOf(modeBuilding) !== -1 &&
          NOTIFY_MODES.indexOf(modeValue) !== -1;

        if (!permitted) {
          skipped.push(key);
          continue;
        }

        setSettingValue(sheet, key, modeValue);
        saved.push(key);
        continue;
      }

      if (GLOBAL_SETTINGS_KEYS.indexOf(key) !== -1) {
        permitted = canSeeAll;
      } else {
        var building = findBuildingForSettingKey(key);
        if (building) {
          permitted = canSeeAll || ctx.buildings.indexOf(building) !== -1;
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

    return { success: true, saved: saved, skipped: skipped };
  } catch (error) {
    Logger.log('saveSettings error: ' + error);
    return { success: false, message: 'An error occurred saving settings.' };
  }
}

/**
 * Gets the admin roster this admin is allowed to see
 * @returns {Object} { success, admins: [{email,role,building,name,active}], canManageAll }
 */
function getAdminsRosterForDashboard() {
  try {
    var ctx = getDashboardContext();
    if (!ctx.authorized) {
      return { success: false, message: 'Not authorized.' };
    }

    var canManageAll = ctx.isSuper || ctx.isDistrict;
    var sheet = getAdminsSheet();
    var data = sheet.getDataRange().getValues();

    var admins = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var email = String(row[0] || '').trim();
      if (!email) continue;

      var role = String(row[1] || '').trim().toLowerCase();
      var building = String(row[2] || '').trim();
      var name = String(row[3] || '');
      var active = row[4] === true || String(row[4]).trim().toUpperCase() === 'TRUE';

      if (canManageAll) {
        admins.push({ email: email, role: role, building: building, name: name, active: active });
      } else if (active && role === ADMIN_ROLES.BUILDING && ctx.buildings.indexOf(building) !== -1) {
        admins.push({ email: email, role: role, building: building, name: name, active: active });
      }
    }

    return { success: true, admins: admins, canManageAll: canManageAll };
  } catch (error) {
    Logger.log('getAdminsRosterForDashboard error: ' + error);
    return { success: false, message: 'An error occurred loading the admin roster.' };
  }
}

/**
 * Finds the sheet row for an exact email+role+building grant
 * @param {Sheet} sheet - The _Admins sheet
 * @param {string} email - Lowercased email
 * @param {string} role - Lowercased role
 * @param {string} building - Building code (or '' for non-building roles)
 * @returns {number} 1-indexed sheet row, or -1 if not found
 */
function findAdminRow(sheet, email, role, building) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var rowEmail = String(data[i][0] || '').trim().toLowerCase();
    var rowRole = String(data[i][1] || '').trim().toLowerCase();
    var rowBuilding = String(data[i][2] || '').trim();

    if (rowEmail === email && rowRole === role && rowBuilding === building) {
      return i + 1;
    }
  }
  return -1;
}

/**
 * Adds (or reactivates) an admin grant. Super/district can grant any role/building;
 * a plain building admin can only add a building-role grant to their own building.
 * @param {string} payloadJson - JSON string: { email, name, role, building }
 * @returns {Object} { success }
 */
function addAdminRow(payloadJson) {
  try {
    var ctx = getDashboardContext();
    if (!ctx.authorized) {
      return { success: false, message: 'Not authorized.' };
    }

    var payload = JSON.parse(payloadJson);
    var email = sanitizeInput(String(payload.email || '').trim()).toLowerCase();
    var name = sanitizeInput(String(payload.name || '').trim());
    var role = String(payload.role || '').trim().toLowerCase();
    var building = String(payload.building || '').trim();

    var canManageAll = ctx.isSuper || ctx.isDistrict;

    if (canManageAll) {
      var validRoles = [ADMIN_ROLES.BUILDING, ADMIN_ROLES.DISTRICT, ADMIN_ROLES.SUPER];
      if (validRoles.indexOf(role) === -1) {
        return { success: false, message: 'Invalid role.' };
      }
      if (role === ADMIN_ROLES.BUILDING && FORM_SCHEMA.building.options.indexOf(building) === -1) {
        return { success: false, message: 'Invalid building.' };
      }
      if (role !== ADMIN_ROLES.BUILDING) {
        building = '';
      }
    } else {
      // Plain building admin: this is "add an admin to my building," nothing broader
      role = ADMIN_ROLES.BUILDING;
      if (!building || ctx.buildings.indexOf(building) === -1) {
        return { success: false, message: 'You can only add an admin to your own building.' };
      }
    }

    if (!isValidEmail(email)) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    var sheet = getAdminsSheet();
    var existingRow = findAdminRow(sheet, email, role, building);

    if (existingRow !== -1) {
      var currentActive = sheet.getRange(existingRow, 5).getValue();
      var isActive = currentActive === true || String(currentActive).trim().toUpperCase() === 'TRUE';

      if (isActive) {
        return { success: false, message: 'This person already has that role.' };
      }

      sheet.getRange(existingRow, 4).setValue(name);
      sheet.getRange(existingRow, 5).setValue(true);
      cache.remove('_admins_roster');
      return { success: true };
    }

    sheet.appendRow([email, role, building, name, true]);
    cache.remove('_admins_roster');
    return { success: true };
  } catch (error) {
    Logger.log('addAdminRow error: ' + error);
    return { success: false, message: 'An error occurred adding the admin.' };
  }
}

/**
 * Activates or deactivates an existing admin grant. Super/district only -
 * a plain building admin can add access but not revoke or restore it.
 * @param {string} payloadJson - JSON string: { email, role, building, active }
 * @returns {Object} { success }
 */
function setAdminRowActive(payloadJson) {
  try {
    var ctx = getDashboardContext();
    if (!ctx.isSuper && !ctx.isDistrict) {
      return { success: false, message: 'Only district or super admins can change an existing admin\'s access.' };
    }

    var payload = JSON.parse(payloadJson);
    var email = String(payload.email || '').trim().toLowerCase();
    var role = String(payload.role || '').trim().toLowerCase();
    var building = String(payload.building || '').trim();
    var active = !!payload.active;

    var sheet = getAdminsSheet();
    var rowIndex = findAdminRow(sheet, email, role, building);

    if (rowIndex === -1) {
      return { success: false, message: 'Admin row not found.' };
    }

    sheet.getRange(rowIndex, 5).setValue(active);
    cache.remove('_admins_roster');
    return { success: true };
  } catch (error) {
    Logger.log('setAdminRowActive error: ' + error);
    return { success: false, message: 'An error occurred updating the admin.' };
  }
}
