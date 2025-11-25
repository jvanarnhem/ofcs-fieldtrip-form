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
    label: 'Destination'
  },
  trip_date: {
    type: 'date',
    columnHeader: 'Trip_Date',
    required: true,
    label: 'Date of Trip',
    validate: 'futureDate'
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
    options: ['HS', 'MS', 'IS', 'FL', 'ECC']
  },

  // Contact Information
  adult_in_charge: {
    type: 'text',
    columnHeader: 'Teacher_Adult_in_Charge',
    required: true,
    maxLength: 100,
    label: 'Teacher/Adult in Charge'
  },
  email: {
    type: 'email',
    columnHeader: 'Email',
    required: true,
    label: 'Email Address',
    validate: 'email'
  },
  phone: {
    type: 'tel',
    columnHeader: 'Phone_Number',
    required: true,
    label: 'Phone Number',
    validate: 'phone'
  },

  // Trip Details
  depart_from: {
    type: 'select',
    columnHeader: 'Depart_From',
    required: true,
    label: 'Depart From',
    options: ['High School', 'Middle School', 'Intermediate School', 'Florence Lawson Elementary', 'Early Childhood Center']
  },
  destination_address: {
    type: 'text',
    columnHeader: 'Destination_Address',
    required: true,
    maxLength: 300,
    label: 'Address of Destination'
  },
  num_students: {
    type: 'number',
    columnHeader: 'Number_of_Students',
    required: true,
    min: 1,
    label: 'Number of Students'
  },
  num_adults: {
    type: 'number',
    columnHeader: 'Number_of_Adults',
    required: true,
    min: 1,
    label: 'Number of Adults/Chaperones'
  },
  num_large_buses: {
    type: 'number',
    columnHeader: 'Number_of_Large_Buses',
    required: true,
    min: 0,
    label: 'Number of Large Buses',
    helpText: 'Large Bus = 56 seated, 2 per seat'
  },
  num_small_buses: {
    type: 'number',
    columnHeader: 'Number_of_Small_Buses',
    required: true,
    min: 0,
    label: 'Number of Small Buses',
    helpText: 'Small Bus = 15-20 passenger capacity (wheelchair accessible with lift)'
  },
  num_vans: {
    type: 'number',
    columnHeader: 'Number_of_Vans',
    required: true,
    min: 0,
    label: 'Number of Vans',
    helpText: 'Van drivers must be van certified prior to driving students'
  },

  // Schedule
  leave_school: {
    type: 'time',
    columnHeader: 'Leave_School',
    required: true,
    label: 'Time Leaving School'
  },
  arrive_destination: {
    type: 'time',
    columnHeader: 'Arrive_Destination',
    required: true,
    label: 'Time Arriving at Destination'
  },
  leave_destination: {
    type: 'time',
    columnHeader: 'Leave_Destination',
    required: true,
    label: 'Time Leaving Destination'
  },
  arrive_school: {
    type: 'time',
    columnHeader: 'Arrive_School',
    required: true,
    label: 'Time Arriving Back at School'
  },
  extra_stop_eat: {
    type: 'radio',
    columnHeader: 'Extra_Stop_Eat',
    required: true,
    label: 'Extra Stop to Eat',
    options: ['Yes', 'No']
  },
  extra_stop_restroom: {
    type: 'radio',
    columnHeader: 'Extra_Stop_Restroom',
    required: true,
    label: 'Extra Stop for Restroom',
    options: ['Yes', 'No']
  },

  // Purpose
  purpose: {
    type: 'textarea',
    columnHeader: 'Purpose',
    required: true,
    maxLength: 1000,
    label: 'Educational Purpose of Trip'
  },
  comments_requests: {
    type: 'textarea',
    columnHeader: 'Comments_and_Special_Requests',
    required: false,
    maxLength: 500,
    label: 'Comments and Special Requests'
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
  approval_doc_url: {
    type: 'url',
    columnHeader: 'Approval_Document_URL',
    systemGenerated: true
  }
};

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
