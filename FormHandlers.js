/**
 * Form Handlers - Modern Backend Functions
 * Handles form submissions and approvals with new architecture
 */

/**
 * Main form submission handler
 * Called from the new form interface
 * @param {string} formDataJson - JSON string of form data
 * @returns {Object} Response object with success status and submission number
 */
function submitFieldTripForm(formDataJson) {
  try {
    // Parse form data
    var rawData = JSON.parse(formDataJson);

    // Process (sanitize and validate) form data
    var processed = processFormData(rawData);

    if (!processed.success) {
      var errorMessages = processed.errors.map(function (e) { return e.message; });
      return {
        success: false,
        message: 'Validation errors: ' + errorMessages.join(', '),
        errors: processed.errors
      };
    }

    var formData = processed.data;

    // Generate Google Maps directions URL if we have both addresses
    if (formData.depart_from && formData.destination_address) {
      var origin = encodeURIComponent(formData.depart_from + ', Olmsted Falls, OH');
      var destination = encodeURIComponent(formData.destination_address);
      formData.directions_url = 'https://www.google.com/maps/dir/?api=1&origin=' + origin + '&destination=' + destination + '&travelmode=driving';
    }

    // Append to spreadsheet
    var submissionNumber = appendSubmission(formData);

    // Get settings for email
    var settings = getSettings();
    var building = formData.building;

    // Determine building admin email
    var adminEmail = settings.DISTRICT_EMAIL || 'ofcsdistrict@ofcs.net';
    var adminName = 'Admin';

    switch (building) {
      case 'HS':
        adminEmail = settings.HS_EMAIL;
        adminName = settings.HS_ADMIN;
        break;
      case 'MS':
        adminEmail = settings.MS_EMAIL;
        adminName = settings.MS_ADMIN;
        break;
      case 'IS':
        adminEmail = settings.IS_EMAIL;
        adminName = settings.IS_ADMIN;
        break;
      case 'FL':
        adminEmail = settings.FL_EMAIL;
        adminName = settings.FL_ADMIN;
        break;
      case 'ECC':
        adminEmail = settings.ECC_EMAIL;
        adminName = settings.ECC_ADMIN;
        break;
    }

    // Send notification email to building admin
    sendBuildingAdminNotification(submissionNumber, formData, adminEmail, adminName);

    // Generate initial submission PDF BEFORE sending confirmation email
    var initialDoc = null;
    if (settings.INITIAL_SUB_FOLDER_ID && settings.TEMPLATE_INIT_ID) {
      try {
        initialDoc = doPreMerge(
          submissionNumber,
          formData.adult_in_charge,
          settings.INITIAL_SUB_FOLDER_ID,
          settings.SPREADSHEET_ID,
          settings.TEMPLATE_INIT_ID
        );
      } catch (pdfError) {
        Logger.log('PDF generation error: ' + pdfError);
        // Don't fail the whole submission if PDF fails
      }
    }

    // Send confirmation email to submitter with attached PDF
    sendSubmitterConfirmation(submissionNumber, formData, initialDoc);

    return {
      success: true,
      submissionNumber: submissionNumber,
      message: 'Your field trip application has been submitted successfully.'
    };

  } catch (error) {
    Logger.log('Form submission error: ' + error);
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again or contact support.'
    };
  }
}

/**
 * Building admin approval handler
 * @param {string} approvalDataJson - JSON string with approval data
 * @returns {Object} Response object
 */
function approveBuildingAdmin(approvalDataJson) {
  try {
    var data = JSON.parse(approvalDataJson);
    var submissionNumber = data.submission_number;
    var action = data.action; // 'approve' or 'reject'
    var comments = sanitizeInput(data.comments || '');

    var submission = findSubmission(submissionNumber);

    if (!submission) {
      return {
        success: false,
        message: 'Submission not found or has already been processed'
      };
    }

    // Check if already reviewed
    var currentStatus = submission.dataObject.status;
    if (currentStatus !== STATUS_VALUES.PENDING_BUILDING) {
      return {
        success: false,
        message: 'This application has already been reviewed. Current status: ' + currentStatus,
        alreadyReviewed: true
      };
    }

    var settings = getSettings();

    if (action === 'reject') {
      // Update status to rejected
      updateSubmission(submissionNumber, {
        status: STATUS_VALUES.REJECTED,
        building_comments: comments,
        building_approval_date: new Date()
      });

      // Send rejection email to submitter
      sendRejectionEmail(submission.dataObject, comments, 'Building Administrator');

      return {
        success: true,
        message: 'Application rejected and submitter notified'
      };

    } else if (action === 'approve') {
      // Update status to pending district approval
      updateSubmission(submissionNumber, {
        status: STATUS_VALUES.PENDING_DISTRICT,
        building_comments: comments,
        building_approval_date: new Date()
      });

      // Send notification to district admin
      sendDistrictAdminNotification(submissionNumber, submission.dataObject, comments, settings.DISTRICT_EMAIL);

      return {
        success: true,
        message: 'Application approved and forwarded to district administrator'
      };
    }

  } catch (error) {
    Logger.log('Building admin approval error: ' + error);
    return {
      success: false,
      message: 'An error occurred processing the approval'
    };
  }
}

/**
 * District admin approval handler
 * @param {string} approvalDataJson - JSON string with approval data
 * @returns {Object} Response object
 */
function approveDistrictAdmin(approvalDataJson) {
  try {
    var data = JSON.parse(approvalDataJson);
    var submissionNumber = data.submission_number;
    var action = data.action; // 'approve' or 'reject'
    var comments = sanitizeInput(data.comments || '');

    var submission = findSubmission(submissionNumber);

    if (!submission) {
      return {
        success: false,
        message: 'Submission not found or has already been processed'
      };
    }

    // Check if already reviewed
    var currentStatus = submission.dataObject.status;
    if (currentStatus !== STATUS_VALUES.PENDING_DISTRICT) {
      return {
        success: false,
        message: 'This application has already been reviewed. Current status: ' + currentStatus,
        alreadyReviewed: true
      };
    }

    var settings = getSettings();

    if (action === 'reject') {
      // Update status to rejected
      updateSubmission(submissionNumber, {
        status: STATUS_VALUES.REJECTED,
        district_comments: comments,
        district_approval_date: new Date()
      });

      // Send rejection email to submitter
      sendRejectionEmail(submission.dataObject, comments, 'District Administrator');

      return {
        success: true,
        message: 'Application rejected and submitter notified'
      };

    } else if (action === 'approve') {
      // Update status to approved first
      updateSubmission(submissionNumber, {
        status: STATUS_VALUES.APPROVED,
        district_comments: comments,
        district_approval_date: new Date()
      });

      // Move to completed sheet BEFORE generating document
      // (so the merge function can find it in the Completed sheet)
      moveToCompleted(submissionNumber);

      // Generate final approval document AFTER moving to Completed
      var approvalDoc = null;
      var approvalDocUrl = '';
      if (settings.DESTINATION_FOLDER_ID && settings.TEMPLATE_ID) {
        try {
          approvalDoc = doMerge(
            submissionNumber,
            submission.dataObject.adult_in_charge,
            settings.DESTINATION_FOLDER_ID,
            settings.SPREADSHEET_ID,
            settings.TEMPLATE_ID
          );
          if (approvalDoc) {
            approvalDocUrl = approvalDoc.getUrl();

            // Update the Completed sheet with the document URL
            var completedSubmission = findSubmission(submissionNumber, 'Completed');
            if (completedSubmission) {
              var completedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Completed');
              var columnMapping = getColumnMapping(completedSheet);
              var urlColIndex = columnMapping['Approval_Document_URL'];
              if (urlColIndex !== undefined) {
                completedSheet.getRange(completedSubmission.rowIndex, urlColIndex + 1).setValue(approvalDocUrl);
              }
            }
          }
        } catch (pdfError) {
          Logger.log('PDF generation error: ' + pdfError);
          Logger.log('Error stack: ' + pdfError.stack);
        }
      }

      // Send final approval email to submitter
      sendFinalApprovalEmail(submission.dataObject, comments, approvalDoc);

      // Send notification to bus garage if applicable
      if (submission.dataObject.transportation === 'School Bus' && settings.FINAL_EMAIL) {
        sendBusGarageNotification(submission.dataObject);
      }

      // Add to calendar if configured
      try {
        if (settings.CALENDAR_ID) {
          addToCalendar(submission.dataObject);
        }
      } catch (calError) {
        Logger.log('Calendar add error: ' + calError);
      }

      return {
        success: true,
        message: 'Application approved, submitter and relevant parties notified'
      };
    }

  } catch (error) {
    Logger.log('District admin approval error: ' + error);
    return {
      success: false,
      message: 'An error occurred processing the approval'
    };
  }
}

/**
 * Gets submission data for admin interfaces
 * @param {number} submissionNumber - The submission number
 * @returns {Object} Submission data
 */
function getSubmissionData(submissionNumber) {
  var submission = findSubmission(submissionNumber);

  if (!submission) {
    return {
      success: false,
      message: 'Submission not found'
    };
  }

  return {
    success: true,
    data: submission.dataObject
  };
}

/**
 * Gets every submission still awaiting building or district action, for the admin dashboard
 * @returns {Object} Response object with success status and pending submissions
 */
function getPendingSubmissions() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Submissions');
    var columnMapping = getColumnMapping(sheet);
    var data = sheet.getDataRange().getValues();

    var pendingStatuses = [STATUS_VALUES.PENDING_BUILDING, STATUS_VALUES.PENDING_DISTRICT];
    var results = [];

    for (var i = 1; i < data.length; i++) {
      var rowObj = rowToObject(data[i], columnMapping);
      if (pendingStatuses.indexOf(rowObj.status) !== -1) {
        results.push(rowObj);
      }
    }

    results.sort(function (a, b) {
      return a.submission_number - b.submission_number;
    });

    // Returned as a JSON string, not a plain object: google.script.run's own object
    // serialization is unreliable for arrays containing Date values (Sheets auto-converts
    // date-looking cells to real dates), so we do the serialization ourselves.
    return JSON.stringify({
      success: true,
      submissions: results
    });

  } catch (error) {
    Logger.log('getPendingSubmissions error: ' + error);
    return JSON.stringify({
      success: false,
      message: 'An error occurred loading pending applications.'
    });
  }
}

/**
 * Looks up all applications submitted under a given email address
 * Searches both the Submissions (pending/rejected) and Completed (approved) sheets
 * @param {string} email - Teacher's email address used on the application(s)
 * @returns {Object} Response object with success status and matching submissions
 */
function getMySubmissions(email) {
  try {
    email = sanitizeInput(String(email || '')).trim().toLowerCase();

    if (!email) {
      return JSON.stringify({
        success: false,
        message: 'Please enter your email address.'
      });
    }

    var results = [];
    var sheetNames = ['Submissions', 'Completed'];

    for (var s = 0; s < sheetNames.length; s++) {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetNames[s]);
      if (!sheet) continue;

      var columnMapping = getColumnMapping(sheet);
      var data = sheet.getDataRange().getValues();

      for (var i = 1; i < data.length; i++) {
        var rowObj = rowToObject(data[i], columnMapping);
        if (rowObj.email && String(rowObj.email).toLowerCase() === email) {
          results.push(rowObj);
        }
      }
    }

    results.sort(function (a, b) {
      return b.submission_number - a.submission_number;
    });

    Logger.log('getMySubmissions: searched for "' + email + '", found ' + results.length + ' match(es)');

    // Returned as a JSON string, not a plain object: google.script.run's own object
    // serialization is unreliable for arrays containing Date values (Sheets auto-converts
    // date-looking cells to real dates), so we do the serialization ourselves.
    return JSON.stringify({
      success: true,
      submissions: results
    });

  } catch (error) {
    Logger.log('getMySubmissions error: ' + error);
    return JSON.stringify({
      success: false,
      message: 'An error occurred looking up your applications.'
    });
  }
}
