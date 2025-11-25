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
      return {
        success: false,
        message: 'Validation errors: ' + processed.errors.join(', ')
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

    // Send confirmation email to submitter
    sendSubmitterConfirmation(submissionNumber, formData);

    // Generate initial submission PDF
    if (settings.INITIAL_SUB_FOLDER_ID && settings.TEMPLATE_INIT_ID) {
      try {
        var doc = doPreMerge(
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
        message: 'Submission not found'
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
        message: 'Submission not found'
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
      // Generate final approval document
      var approvalDoc = null;
      if (settings.DESTINATION_FOLDER_ID && settings.TEMPLATE_ID) {
        try {
          approvalDoc = doMerge(
            submissionNumber,
            submission.dataObject.adult_in_charge,
            settings.DESTINATION_FOLDER_ID,
            settings.SPREADSHEET_ID,
            settings.TEMPLATE_ID
          );
        } catch (pdfError) {
          Logger.log('PDF generation error: ' + pdfError);
        }
      }

      // Update status to approved and move to completed
      updateSubmission(submissionNumber, {
        status: STATUS_VALUES.APPROVED,
        district_comments: comments,
        district_approval_date: new Date(),
        approval_doc_url: approvalDoc ? approvalDoc.getUrl() : ''
      });

      // Move to completed sheet
      moveToCompleted(submissionNumber);

      // Send final approval email to submitter
      sendFinalApprovalEmail(submission.dataObject, comments, approvalDoc);

      // Send notification to bus garage if applicable
      if (submission.dataObject.transportation === 'School Bus' && settings.BUS_GARAGE_EMAIL) {
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
