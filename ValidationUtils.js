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
 * Validates form data against schema
 * @param {Object} formData - The form data to validate
 * @returns {Object} Object with isValid boolean and errors array
 */
function validateFormData(formData) {
  var errors = [];

  for (var key in FORM_SCHEMA) {
    var field = FORM_SCHEMA[key];

    // Skip system-generated and admin-only fields
    if (field.systemGenerated || field.adminOnly) {
      continue;
    }

    var value = formData[key];

    // Check required fields
    if (field.required && (!value || value === '')) {
      errors.push(field.label + ' is required');
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
          errors.push(field.label + ' must be a valid email address');
        }
        break;

      case 'tel':
        if (!isValidPhone(value)) {
          errors.push(field.label + ' must be a valid phone number');
        }
        break;

      case 'date':
        if (!isValidDate(value)) {
          errors.push(field.label + ' must be a valid date');
        } else if (field.validate === 'futureDate' && !isFutureDate(value)) {
          errors.push(field.label + ' must be a future date');
        }
        break;

      case 'time':
        if (!isValidTime(value)) {
          errors.push(field.label + ' must be a valid time (HH:MM)');
        }
        break;

      case 'number':
        var num = parseFloat(value);
        if (isNaN(num)) {
          errors.push(field.label + ' must be a number');
        } else {
          if (field.min !== undefined && num < field.min) {
            errors.push(field.label + ' must be at least ' + field.min);
          }
          if (field.max !== undefined && num > field.max) {
            errors.push(field.label + ' must be at most ' + field.max);
          }
        }
        break;

      case 'text':
      case 'textarea':
        if (field.maxLength && value.length > field.maxLength) {
          errors.push(field.label + ' must be less than ' + field.maxLength + ' characters');
        }
        break;
    }

    // Conditional field validation
    if (field.conditionalOn) {
      var conditionField = field.conditionalOn.field;
      var conditionValue = field.conditionalOn.value;

      if (formData[conditionField] === conditionValue && field.required && !value) {
        errors.push(field.label + ' is required when ' + FORM_SCHEMA[conditionField].label + ' is ' + conditionValue);
      }
    }
  }

  // Custom cross-field validations
  // Validate time sequences
  if (formData.leave_school && formData.arrive_destination) {
    if (!isValidTimeSequence(formData.leave_school, formData.arrive_destination)) {
      errors.push('Arrival at destination must be after leaving school');
    }
  }

  if (formData.arrive_destination && formData.leave_destination) {
    if (!isValidTimeSequence(formData.arrive_destination, formData.leave_destination)) {
      errors.push('Leaving destination must be after arriving at destination');
    }
  }

  if (formData.leave_destination && formData.arrive_school) {
    if (!isValidTimeSequence(formData.leave_destination, formData.arrive_school)) {
      errors.push('Arriving back at school must be after leaving destination');
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
 * @returns {Object} Object with success, data (if valid), and errors (if invalid)
 */
function processFormData(formData) {
  // First sanitize
  var sanitized = sanitizeFormData(formData);

  // Then validate
  var validation = validateFormData(sanitized);

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
