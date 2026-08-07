/**
 * Configuration and Schema Definition
 * This file defines the form structure and column mappings
 */

/**
 * Form field schema - defines all form fields with validation rules
 * This is the single source of truth for form structure
 */
var FORM_SCHEMA = {
  // System fields (auto-generated)
  submission_number: {
    type: 'number',
    columnHeader: 'Submission_Number',
    systemGenerated: true
  },
  timestamp: {
    type: 'date',
    columnHeader: 'Timestamp',
    systemGenerated: true
  },
  status: {
    type: 'text',
    columnHeader: 'Status',
    systemGenerated: true,
    defaultValue: 'Pending Building Approval'
  },

  // Trip Information
  destination: {
    type: 'text',
    columnHeader: 'Destination',
    required: true,
    maxLength: 200,
    label: 'Destination',
    section: 'Trip Information',
    col: 12
  },
  trip_date: {
    type: 'date',
    columnHeader: 'Trip_Date',
    required: true,
    label: 'Date of Trip',
    validate: 'futureDate',
    section: 'Trip Information',
    col: 6
  },
  day_of_week: {
    type: 'text',
    columnHeader: 'Day_of_Week',
    systemGenerated: true
  },
  building: {
    type: 'select',
    columnHeader: 'Building',
    required: true,
    label: 'Building',
    options: ['HS', 'MS', 'IS', 'FL', 'ECC'],
    optionLabels: {
      HS: 'High School',
      MS: 'Middle School',
      IS: 'Intermediate School',
      FL: 'Florence Lawson Elementary',
      ECC: 'Early Childhood Center'
    },
    section: 'Trip Information',
    col: 6
  },

  // Contact Information
  adult_in_charge: {
    type: 'text',
    columnHeader: 'Teacher_Adult_in_Charge',
    required: true,
    maxLength: 100,
    label: 'Teacher/Adult in Charge',
    section: 'Contact Information',
    col: 12
  },
  email: {
    type: 'email',
    columnHeader: 'Email',
    required: true,
    label: 'Email Address',
    validate: 'email',
    section: 'Contact Information',
    col: 6
  },
  phone: {
    type: 'tel',
    columnHeader: 'Phone_Number',
    required: true,
    label: 'Phone Number',
    validate: 'phone',
    placeholder: '(XXX) XXX-XXXX',
    section: 'Contact Information',
    col: 6
  },

  // Trip Details
  depart_from: {
    type: 'select',
    columnHeader: 'Depart_From',
    required: true,
    label: 'Depart From',
    options: ['High School', 'Middle School', 'Intermediate School', 'Florence Lawson Elementary', 'Early Childhood Center'],
    section: 'Trip Logistics',
    col: 6
  },
  destination_address: {
    type: 'text',
    columnHeader: 'Destination_Address',
    required: true,
    maxLength: 300,
    label: 'Address of Destination',
    placeholder: 'Full street address',
    helpText: 'Click "Directions" to view route on Google Maps',
    directionsButton: true,
    section: 'Trip Logistics',
    col: 6
  },
  directions_url: {
    type: 'url',
    columnHeader: 'Directions_URL',
    systemGenerated: true
  },
  num_students: {
    type: 'number',
    columnHeader: 'Number_of_Students',
    required: true,
    min: 1,
    label: 'Number of Students',
    section: 'Group Details',
    col: 6
  },
  num_adults: {
    type: 'number',
    columnHeader: 'Number_of_Adults',
    required: true,
    min: 1,
    label: 'Number of Chaperones',
    section: 'Group Details',
    col: 6
  },
  num_large_buses: {
    type: 'number',
    columnHeader: 'Number_of_Large_Buses',
    required: true,
    min: 0,
    defaultValue: 0,
    label: 'Number of Large Buses',
    helpText: 'Large Bus = 56 seated, 2 per seat',
    section: 'Transportation Needs',
    col: 4
  },
  num_small_buses: {
    type: 'number',
    columnHeader: 'Number_of_Small_Buses',
    required: true,
    min: 0,
    defaultValue: 0,
    label: 'Number of Small Buses',
    helpText: '15-20 passenger (wheelchair accessible with lift)',
    section: 'Transportation Needs',
    col: 4
  },
  num_vans: {
    type: 'number',
    columnHeader: 'Number_of_Vans',
    required: true,
    min: 0,
    defaultValue: 0,
    label: 'Number of Vans',
    helpText: 'Van drivers must be van certified',
    section: 'Transportation Needs',
    col: 4
  },

  // Schedule
  leave_school: {
    type: 'time',
    columnHeader: 'Leave_School',
    required: true,
    label: 'Time Leaving School',
    section: 'Schedule',
    col: 6
  },
  arrive_destination: {
    type: 'time',
    columnHeader: 'Arrive_Destination',
    required: true,
    label: 'Time Arriving at Destination',
    section: 'Schedule',
    col: 6
  },
  leave_destination: {
    type: 'time',
    columnHeader: 'Leave_Destination',
    required: true,
    label: 'Time Leaving Destination',
    section: 'Schedule',
    col: 6
  },
  arrive_school: {
    type: 'time',
    columnHeader: 'Arrive_School',
    required: true,
    label: 'Time Arriving Back at School',
    section: 'Schedule',
    col: 6
  },
  extra_stop_eat: {
    type: 'radio',
    columnHeader: 'Extra_Stop_Eat',
    required: true,
    label: 'Extra Stop to Eat',
    options: ['Yes', 'No'],
    section: 'Schedule',
    col: 6
  },
  extra_stop_restroom: {
    type: 'radio',
    columnHeader: 'Extra_Stop_Restroom',
    required: true,
    label: 'Extra Stop for Restroom',
    options: ['Yes', 'No'],
    section: 'Schedule',
    col: 6
  },

  // Purpose
  purpose: {
    type: 'textarea',
    columnHeader: 'Purpose',
    required: true,
    maxLength: 1000,
    label: 'Educational Purpose of Trip',
    placeholder: 'Describe the educational purpose and learning objectives of this field trip',
    section: 'Educational Purpose',
    col: 12
  },
  comments_requests: {
    type: 'textarea',
    columnHeader: 'Comments_and_Special_Requests',
    required: false,
    maxLength: 500,
    label: 'Comments and Special Requests',
    placeholder: 'Any special requests or additional comments about this trip',
    section: 'Educational Purpose',
    col: 12
  },

  // Approval Fields
  building_admin: {
    type: 'text',
    columnHeader: 'Building_Admin',
    systemGenerated: true
  },
  building_comments: {
    type: 'textarea',
    columnHeader: 'Building_Comments',
    adminOnly: true
  },
  building_approval_date: {
    type: 'date',
    columnHeader: 'Building_Approval_Date',
    systemGenerated: true
  },
  building_reviewed_by: {
    type: 'text',
    columnHeader: 'Building_Reviewed_By',
    systemGenerated: true
  },
  district_comments: {
    type: 'textarea',
    columnHeader: 'District_Comments',
    adminOnly: true
  },
  district_approval_date: {
    type: 'date',
    columnHeader: 'District_Approval_Date',
    systemGenerated: true
  },
  district_reviewed_by: {
    type: 'text',
    columnHeader: 'District_Reviewed_By',
    systemGenerated: true
  },
  approval_doc_url: {
    type: 'url',
    columnHeader: 'Approval_Document_URL',
    systemGenerated: true
  }
};

/**
 * Ordered chain of Schedule-section time fields; consecutive entries must be
 * increasing. Single source of truth for the cross-field time-sequence checks
 * in ValidationUtils.js and FormNew.html.
 */
var TIME_SEQUENCE_FIELDS = ['leave_school', 'arrive_destination', 'leave_destination', 'arrive_school'];

/**
 * Trips with a trip_date before this cutover live in the "Archives" sheet
 * (browsed by year in the dashboard); trips on/after it live in "Submissions"
 * alongside everything actively being worked. This is when the rewritten app
 * went live - a one-time boundary, not a rolling window.
 */
var ARCHIVE_CUTOFF_DATE = '2026-06-01';

/**
 * Status values for the approval workflow
 */
var STATUS_VALUES = {
  PENDING_BUILDING: 'Pending Building Approval',
  PENDING_DISTRICT: 'Pending District Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected'
};

/**
 * Get ordered list of column headers for spreadsheet
 * @returns {string[]} Array of column header names in order
 */
function getColumnHeaders() {
  return Object.keys(FORM_SCHEMA).map(function(key) {
    return FORM_SCHEMA[key].columnHeader;
  });
}

/**
 * Get form fields for user-facing form (excludes system and admin fields)
 * @returns {Object} Filtered schema for form rendering
 */
function getUserFormFields() {
  var userFields = {};
  for (var key in FORM_SCHEMA) {
    var field = FORM_SCHEMA[key];
    if (!field.systemGenerated && !field.adminOnly) {
      userFields[key] = field;
    }
  }
  return userFields;
}

/**
 * Get validation rules as JSON for frontend
 * @returns {string} JSON string of validation rules
 */
function getValidationRules() {
  var rules = {};
  for (var key in FORM_SCHEMA) {
    var field = FORM_SCHEMA[key];
    if (field.required || field.validate || field.maxLength || field.min || field.max) {
      rules[key] = {
        required: field.required || false,
        type: field.type,
        validate: field.validate,
        maxLength: field.maxLength,
        min: field.min,
        max: field.max
      };
    }
  }
  return JSON.stringify(rules);
}
