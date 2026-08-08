/**
 * Validation and Sanitization Utilities
 * Server-side validation and input sanitization
 */

/**
 * Sanitizes user input to prevent XSS and other attacks
 * @param {string} input - The raw input string
 * @returns {string} Sanitized string
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return input;
  }

  // Remove any HTML tags
  var sanitized = input.replace(/<[^>]*>/g, '');

  // Encode special characters
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Validates email format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates phone number format (US format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone format
 */
function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // Remove all non-numeric characters
  var cleaned = phone.replace(/\D/g, '');

  // Check if it's 10 or 11 digits (with or without country code)
  return cleaned.length === 10 || cleaned.length === 11;
}

/**
 * Formats phone number to standard format
 * @param {string} phone - Raw phone number
 * @returns {string} Formatted phone number (XXX) XXX-XXXX
 */
function formatPhone(phone) {
  if (!phone) return '';

  var cleaned = phone.replace(/\D/g, '');

  // Handle 11-digit numbers (with country code)
  if (cleaned.length === 11 && cleaned[0] === '1') {
    cleaned = cleaned.substring(1);
  }

  if (cleaned.length === 10) {
    return '(' + cleaned.substring(0, 3) + ') ' + cleaned.substring(3, 6) + '-' + cleaned.substring(6);
  }

  return phone; // Return original if can't format
}

/**
 * Validates date is in the future
 * @param {string|Date} date - Date to validate
 * @returns {boolean} True if date is in the future
 */
function isFutureDate(date) {
  var checkDate = new Date(date);
  var today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of today

  return checkDate >= today;
}

/**
 * Validates a date string format
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} True if valid date
 */
function isValidDate(dateStr) {
  if (!dateStr) return false;

  var date = new Date(dateStr);
  return date instanceof Date && !isNaN(date);
}

/**
 * Validates a time string (HH:MM format)
 * @param {string} timeStr - Time string to validate
 * @returns {boolean} True if valid time format
 */
function isValidTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') {
    return false;
  }

  var timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeStr);
}

/**
 * Validates that leave time is before arrive time
 * @param {string} leaveTime - Leave time string
 * @param {string} arriveTime - Arrive time string
 * @returns {boolean} True if leave is before arrive
 */
function isValidTimeSequence(leaveTime, arriveTime) {
  if (!isValidTime(leaveTime) || !isValidTime(arriveTime)) {
    return false;
  }

  var leave = timeToMinutes(leaveTime);
  var arrive = timeToMinutes(arriveTime);

  return leave < arrive;
}

/**
 * Converts time string to minutes since midnight
 * @param {string} timeStr - Time in HH:MM format
 * @returns {number} Minutes since midnight
 */
function timeToMinutes(timeStr) {
  var parts = timeStr.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

/**
 * Normalizes an address for loose (case/whitespace/punctuation-insensitive) comparison
 * @param {string} address
 * @returns {string}
 */
function normalizeAddressForComparison(address) {
  return String(address || '')
    .toLowerCase()
    .replace(/[.,#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Pulls out just the street number + first word of the street name (e.g.
// "123 main" from "123 Main St, Springfield, OH 44017") so that suite/unit
// numbers, city, state, zip, and "St" vs "Street" don't prevent a match.
// Returns null if the address doesn't start with a number (can't extract a key).
function extractStreetKey(address) {
  var match = normalizeAddressForComparison(address).match(/^(\d+)\s+([a-z0-9]+)/);
  return match ? (match[1] + ' ' + match[2]) : null;
}

/**
 * Validates form data against schema
 * @param {Object} formData - The form data to validate
 * @param {Object} options - Optional flags. { allowPastTripDate: true } skips the futureDate check
 * @returns {Object} Object with isValid boolean and errors array
 */
function validateFormData(formData, options) {
  options = options || {};
  var errors = [];

  function addError(field, message) {
    errors.push({ field: field, message: message });
  }

  for (var key in FORM_SCHEMA) {
    var field = FORM_SCHEMA[key];

    // Skip system-generated and admin-only fields
    if (field.systemGenerated || field.adminOnly) {
      continue;
    }

    var value = formData[key];

    // Check required fields
    if (field.required && (!value || value === '')) {
      addError(key, field.label + ' is required');
      continue;
    }

    // Skip validation for empty optional fields
    if (!value && !field.required) {
      continue;
    }

    // Type-specific validation
    switch (field.type) {
      case 'email':
        if (!isValidEmail(value)) {
          addError(key, field.label + ' must be a valid email address');
        }
        break;

      case 'tel':
        if (!isValidPhone(value)) {
          addError(key, field.label + ' must be a valid phone number');
        }
        break;

      case 'date':
        if (!isValidDate(value)) {
          addError(key, field.label + ' must be a valid date');
        } else if (field.validate === 'futureDate' && !options.allowPastTripDate && !isFutureDate(value)) {
          addError(key, field.label + ' must be a future date');
        }
        break;

      case 'time':
        if (!isValidTime(value)) {
          addError(key, field.label + ' must be a valid time (HH:MM)');
        }
        break;

      case 'number':
        var num = parseFloat(value);
        if (isNaN(num)) {
          addError(key, field.label + ' must be a number');
        } else {
          if (field.min !== undefined && num < field.min) {
            addError(key, field.label + ' must be at least ' + field.min);
          }
          if (field.max !== undefined && num > field.max) {
            addError(key, field.label + ' must be at most ' + field.max);
          }
        }
        break;

      case 'text':
      case 'textarea':
        if (field.maxLength && value.length > field.maxLength) {
          addError(key, field.label + ' must be less than ' + field.maxLength + ' characters');
        }
        break;
    }

    // Conditional field validation
    if (field.conditionalOn) {
      var conditionField = field.conditionalOn.field;
      var conditionValue = field.conditionalOn.value;

      if (formData[conditionField] === conditionValue && field.required && !value) {
        addError(key, field.label + ' is required when ' + FORM_SCHEMA[conditionField].label + ' is ' + conditionValue);
      }
    }
  }

  // Custom cross-field validations
  // Validate time sequences: each field in TIME_SEQUENCE_FIELDS must be after the previous one
  for (var i = 1; i < TIME_SEQUENCE_FIELDS.length; i++) {
    var prevKey = TIME_SEQUENCE_FIELDS[i - 1];
    var curKey = TIME_SEQUENCE_FIELDS[i];

    if (formData[prevKey] && formData[curKey] && !isValidTimeSequence(formData[prevKey], formData[curKey])) {
      addError(curKey, FORM_SCHEMA[curKey].label + ' must be after ' + FORM_SCHEMA[prevKey].label.toLowerCase());
    }
  }

  // Catches a common mistake: entering the departure school's own address as the
  // destination. Only checked once that school's address has actually been
  // configured in _Settings (<CODE>_ADDRESS, via the dashboard's Settings tab) -
  // silently skipped otherwise, since there's nothing to compare against.
  if (formData.depart_from && formData.destination_address) {
    var departBuildingCode = null;
    for (var buildingCode in FORM_SCHEMA.building.optionLabels) {
      if (FORM_SCHEMA.building.optionLabels[buildingCode] === formData.depart_from) {
        departBuildingCode = buildingCode;
        break;
      }
    }

    if (departBuildingCode) {
      var schoolAddress = getSettings()[departBuildingCode + '_ADDRESS'];

      if (schoolAddress) {
        var schoolStreetKey = extractStreetKey(schoolAddress);
        var destStreetKey = extractStreetKey(formData.destination_address);

        var isSameAddress = schoolStreetKey && destStreetKey
          ? schoolStreetKey === destStreetKey
          : normalizeAddressForComparison(schoolAddress) === normalizeAddressForComparison(formData.destination_address);

        if (isSameAddress) {
          addError('destination_address', 'This matches ' + formData.depart_from + '\'s own address - did you mean to enter the destination\'s address instead?');
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * Sanitizes entire form data object
 * @param {Object} formData - Raw form data
 * @returns {Object} Sanitized form data
 */
function sanitizeFormData(formData) {
  var sanitized = {};

  for (var key in formData) {
    var value = formData[key];

    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(function(item) {
        return typeof item === 'string' ? sanitizeInput(item) : item;
      });
    } else {
      sanitized[key] = value;
    }
  }

  // Format phone number
  if (sanitized.phone) {
    sanitized.phone = formatPhone(sanitized.phone);
  }

  return sanitized;
}

/**
 * Complete validation and sanitization pipeline
 * @param {Object} formData - Raw form data
 * @param {Object} options - Optional flags passed through to validateFormData
 * @returns {Object} Object with success, data (if valid), and errors (if invalid)
 */
function processFormData(formData, options) {
  // First sanitize
  var sanitized = sanitizeFormData(formData);

  // Then validate
  var validation = validateFormData(sanitized, options);

  if (validation.isValid) {
    return {
      success: true,
      data: sanitized
    };
  } else {
    return {
      success: false,
      errors: validation.errors
    };
  }
}
