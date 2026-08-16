/**
 * Email Service
 * Handles all email notifications for the field trip workflow
 */

/**
 * Formats a date for email display
 * @param {string|Date} dateValue - Date to format
 * @returns {string} Formatted date (e.g., "Jan. 5, 2026")
 */
function formatEmailDate(dateValue) {
  if (!dateValue) return '-';

  var date;

  // Handle different date formats
  if (typeof dateValue === 'string') {
    if (dateValue.includes('T')) {
      // ISO string like "2026-01-05T05:00:00.000Z" or just the date part
      var datePart = dateValue.split('T')[0];
      var parts = datePart.split('-');
      date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else if (dateValue.includes('-')) {
      // YYYY-MM-DD format
      var parts = dateValue.split('-');
      date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
      date = new Date(dateValue);
    }
  } else {
    date = new Date(dateValue);
  }

  var months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
  return months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
}

/**
 * Safety net so an unexpected failure anywhere in the app gets flagged to a
 * person instead of silently returning { success: false } to just the one
 * browser tab that happened to be open (or, for a trigger-run function like
 * sendDailyDigests, to no one at all). Called from every RPC/trigger
 * function's own top-level catch block - see each call site for what's
 * actually being guarded. Recipient is _Settings' ERROR_NOTIFY_EMAIL
 * (dashboard-configurable, Settings tab) with a hardcoded fallback so this
 * still works even before that setting's ever been touched.
 * Best-effort and deliberately swallows its own failures - a broken
 * notification path must never mask, or throw on top of, the original error.
 * @param {string} context - Name of the function where the error was caught
 * @param {*} error - The caught error (may not always be a real Error object)
 */
function notifySystemError(context, error) {
  try {
    var settings = getSettings();
    var recipient = settings.ERROR_NOTIFY_EMAIL || 'jvanarnhem@ofcs.net';

    var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">';
    htmlBody += '<h2 style="color: #dc3545;">Field Trip App Error</h2>';
    htmlBody += '<p><strong>Function:</strong> ' + context + '</p>';
    htmlBody += '<p><strong>Time:</strong> ' + new Date().toString() + '</p>';
    htmlBody += '<p><strong>Error:</strong> ' + (error && error.message ? error.message : String(error)) + '</p>';
    if (error && error.stack) {
      htmlBody += '<p><strong>Stack:</strong></p><pre style="white-space: pre-wrap; background: #f8f9fa; padding: 10px;">' + error.stack + '</pre>';
    }
    htmlBody += '</div>';

    MailApp.sendEmail({
      to: recipient,
      subject: 'Field Trip App Error: ' + context,
      htmlBody: htmlBody
    });
  } catch (notifyError) {
    Logger.log('notifySystemError itself failed to send: ' + notifyError);
  }
}

/**
 * Sends notification to building administrator when form is submitted
 * @param {number} submissionNumber - Unique submission ID
 * @param {Object} formData - The submission data
 * @param {string} adminEmail - Building admin email
 * @param {string} adminName - Building admin name
 */
function sendBuildingAdminNotification(submissionNumber, formData, adminEmail, adminName) {
  // Direct single-submission review link - retired in favor of routing everyone through
  // the dashboard below, but kept computed/unused so it's a one-line revert if we want
  // the direct link back (see the commented-out button further down).
  var approvalUrl = ScriptApp.getService().getUrl() +
    '?idNum=' + submissionNumber + '&action=buildingReview';
  var dashboardUrl = ScriptApp.getService().getUrl() + '?dashboard=1';

  var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">';
  htmlBody += '<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">';
  htmlBody += '<h1 style="margin: 0;">Field Trip Application Submitted</h1>';
  htmlBody += '</div>';

  htmlBody += '<div style="padding: 20px; background: #f8f9fa;">';
  htmlBody += '<p>Dear ' + adminName + ',</p>';
  htmlBody += '<p>A new field trip application has been submitted and requires your review.</p>';

  htmlBody += '<div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">';
  htmlBody += '<h2 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px;">Application Summary</h2>';
  htmlBody += '<table style="width: 100%; border-collapse: collapse;">';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Submission #:</td><td style="padding: 8px;">' + submissionNumber + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Destination:</td><td style="padding: 8px;">' + formData.destination + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Date:</td><td style="padding: 8px;">' + formatEmailDate(formData.trip_date) + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Teacher:</td><td style="padding: 8px;">' + formData.adult_in_charge + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Students:</td><td style="padding: 8px;">' + formData.num_students + '</td></tr>';
  htmlBody += '</table>';
  htmlBody += '</div>';

  htmlBody += '<div style="text-align: center; margin: 30px 0;">';
  // htmlBody += '<a href="' + approvalUrl + '" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">Review Application</a>';
  // htmlBody += '<p style="margin-top: 15px;"><a href="' + dashboardUrl + '" style="color: #667eea;">Or view all pending trips in the dashboard</a></p>';
  htmlBody += '<a href="' + dashboardUrl + '" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">Review in Dashboard</a>';
  htmlBody += '</div>';

  htmlBody += '<p style="color: #6c757d; font-size: 14px;">Please review this application at your earliest convenience. Click the button above to view full details and provide your approval decision.</p>';
  htmlBody += '</div>';

  htmlBody += '<div style="background: #e9ecef; padding: 15px; text-align: center; font-size: 12px; color: #6c757d;">';
  htmlBody += '<p>Owen D. Young Central School District - Field Trip Management System</p>';
  htmlBody += '</div>';
  htmlBody += '</div>';

  try {
    MailApp.sendEmail({
      to: adminEmail,
      subject: 'ACTION REQUIRED: Field Trip Application #' + submissionNumber,
      htmlBody: htmlBody
    });
  } catch (error) {
    Logger.log('Error sending building admin notification: ' + error);
    notifySystemError('sendBuildingAdminNotification (#' + submissionNumber + ')', error);
  }
}

/**
 * Sends confirmation email to the person who submitted the form
 * @param {number} submissionNumber - Unique submission ID
 * @param {Object} formData - The submission data
 * @param {Document} submissionDoc - Optional initial submission document to attach
 * @param {Object} settings - _Settings map, used for the lunch cost reminder below
 */
function sendSubmitterConfirmation(submissionNumber, formData, submissionDoc, settings) {
  var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">';
  htmlBody += '<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">';
  htmlBody += '<h1 style="margin: 0;">✓ Application Received</h1>';
  htmlBody += '</div>';

  htmlBody += '<div style="padding: 20px; background: #f8f9fa;">';
  htmlBody += '<p>Dear ' + formData.adult_in_charge + ',</p>';
  htmlBody += '<p>Thank you for submitting your field trip application. Your submission has been received and is being reviewed.</p>';

  htmlBody += '<div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">';
  htmlBody += '<h2 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px;">Submission Details</h2>';
  htmlBody += '<table style="width: 100%; border-collapse: collapse;">';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Confirmation #:</td><td style="padding: 8px;">' + submissionNumber + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Destination:</td><td style="padding: 8px;">' + formData.destination + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Date:</td><td style="padding: 8px;">' + formatEmailDate(formData.trip_date) + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Number of Students:</td><td style="padding: 8px;">' + formData.num_students + '</td></tr>';
  htmlBody += '</table>';
  htmlBody += '</div>';

  htmlBody += '<div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">';
  htmlBody += '<h3 style="margin-top: 0; color: #856404;">Next Steps</h3>';
  htmlBody += '<ol style="margin: 0; padding-left: 20px;">';
  htmlBody += '<li>Your building administrator will review your application</li>';
  htmlBody += '<li>If approved, it will be forwarded to the district office</li>';
  htmlBody += '<li>You will receive email updates at each stage</li>';
  htmlBody += '</ol>';
  htmlBody += '</div>';

  // Real counts aren't known yet at submission time - point the teacher to the
  // self-service entry page instead of asking for names right now
  if (formData.school_lunch === 'Yes') {
    var lunchEntryUrl = ScriptApp.getService().getUrl() + '?idNum=' + submissionNumber + '&action=lunchEntry';
    htmlBody += '<div style="background: #d1ecf1; border-left: 4px solid #0dcaf0; padding: 15px; margin: 20px 0;">';
    htmlBody += '<h3 style="margin-top: 0; color: #055160;">School Prepared Lunch</h3>';
    htmlBody += '<p>You indicated this trip needs school-prepared lunch. When you know your final counts, submit them here:</p>';
    htmlBody += '<p><a href="' + lunchEntryUrl + '" style="color: #055160; font-weight: bold;">Submit Lunch Counts</a></p>';
    htmlBody += '<p>The Food Services Department needs at least a week\'s notice to guarantee orders can be processed. Trips with less than a week\'s notice should contact food service directly.</p>';
    htmlBody += '<p style="margin-bottom: 0;">' + buildLunchCostReminderText(settings || {}) + '</p>';
    htmlBody += '</div>';
  }

  if (submissionDoc) {
    htmlBody += '<p><strong>Your submission document is attached.</strong> Please print and keep for your records.</p>';
  }

  htmlBody += '<p style="color: #6c757d;">If you have any questions or need to make changes to your application, please contact your building administrator.</p>';
  htmlBody += '</div>';

  htmlBody += '<div style="background: #e9ecef; padding: 15px; text-align: center; font-size: 12px; color: #6c757d;">';
  htmlBody += '<p>Owen D. Young Central School District - Field Trip Management System</p>';
  htmlBody += '</div>';
  htmlBody += '</div>';

  try {
    var emailOptions = {
      to: formData.email,
      subject: 'CONFIRMATION: Field Trip Application #' + submissionNumber,
      htmlBody: htmlBody
    };

    // Attach PDF if document was provided
    if (submissionDoc) {
      var pdf = submissionDoc.getAs('application/pdf');
      pdf.setName(submissionNumber + ' Field Trip Application.pdf');
      emailOptions.attachments = [pdf];
    }

    MailApp.sendEmail(emailOptions);
  } catch (error) {
    Logger.log('Error sending submitter confirmation: ' + error);
    notifySystemError('sendSubmitterConfirmation (#' + submissionNumber + ')', error);
  }
}

/**
 * Sends notification to district administrator after building admin approves
 * @param {number} submissionNumber - Unique submission ID
 * @param {Object} formData - The submission data
 * @param {string} buildingComments - Comments from building admin
 * @param {string} districtEmail - District admin email
 * @param {string} districtAdminName - District admin name
 */
function sendDistrictAdminNotification(submissionNumber, formData, buildingComments, districtEmail, districtAdminName) {
  // Direct single-submission review link - retired in favor of routing everyone through
  // the dashboard below, but kept computed/unused so it's a one-line revert if we want
  // the direct link back (see the commented-out button further down).
  var approvalUrl = ScriptApp.getService().getUrl() +
    '?idNum=' + submissionNumber + '&action=districtReview';
  var dashboardUrl = ScriptApp.getService().getUrl() + '?dashboard=1';

  var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">';
  htmlBody += '<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">';
  htmlBody += '<h1 style="margin: 0;">Field Trip Application - Building Approved</h1>';
  htmlBody += '</div>';

  htmlBody += '<div style="padding: 20px; background: #f8f9fa;">';
  htmlBody += '<p>Dear ' + (districtAdminName || 'Admin') + ',</p>';
  htmlBody += '<p>A field trip application has been approved by the building administrator and requires district-level review.</p>';

  htmlBody += '<div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">';
  htmlBody += '<h2 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px;">Application Summary</h2>';
  htmlBody += '<table style="width: 100%; border-collapse: collapse;">';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Submission #:</td><td style="padding: 8px;">' + submissionNumber + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Destination:</td><td style="padding: 8px;">' + formData.destination + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Date:</td><td style="padding: 8px;">' + formatEmailDate(formData.trip_date) + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Teacher:</td><td style="padding: 8px;">' + formData.adult_in_charge + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Building:</td><td style="padding: 8px;">' + formData.building + '</td></tr>';
  htmlBody += '</table>';
  htmlBody += '</div>';

  if (buildingComments) {
    var buildingAdminName = formData.building_admin || 'Building Administrator';
    htmlBody += '<div style="background: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin: 20px 0;">';
    htmlBody += '<h3 style="margin-top: 0; color: #0c5460;">' + buildingAdminName + ' Comments</h3>';
    htmlBody += '<p style="margin: 0;">' + buildingComments + '</p>';
    htmlBody += '</div>';
  }

  htmlBody += '<div style="text-align: center; margin: 30px 0;">';
  // htmlBody += '<a href="' + approvalUrl + '" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">Review Application</a>';
  // htmlBody += '<p style="margin-top: 15px;"><a href="' + dashboardUrl + '" style="color: #667eea;">Or view all pending trips in the dashboard</a></p>';
  htmlBody += '<a href="' + dashboardUrl + '" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">Review in Dashboard</a>';
  htmlBody += '</div>';

  htmlBody += '</div>';

  htmlBody += '<div style="background: #e9ecef; padding: 15px; text-align: center; font-size: 12px; color: #6c757d;">';
  htmlBody += '<p>Owen D. Young Central School District - Field Trip Management System</p>';
  htmlBody += '</div>';
  htmlBody += '</div>';

  try {
    MailApp.sendEmail({
      to: districtEmail,
      subject: 'ACTION REQUIRED: Field Trip Application #' + submissionNumber + ' (Building Approved)',
      htmlBody: htmlBody
    });
  } catch (error) {
    Logger.log('Error sending district admin notification: ' + error);
    notifySystemError('sendDistrictAdminNotification (#' + submissionNumber + ')', error);
  }
}

/**
 * Sends rejection email to submitter
 * @param {Object} formData - The submission data
 * @param {string} comments - Rejection comments
 * @param {string} rejectedBy - Who rejected it
 */
function sendRejectionEmail(formData, comments, rejectedBy) {
  var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">';
  htmlBody += '<div style="background: #dc3545; color: white; padding: 20px; text-align: center;">';
  htmlBody += '<h1 style="margin: 0;">Field Trip Application - Not Approved</h1>';
  htmlBody += '</div>';

  htmlBody += '<div style="padding: 20px; background: #f8f9fa;">';
  htmlBody += '<p>Dear ' + formData.adult_in_charge + ',</p>';
  htmlBody += '<p>Your field trip application has not been approved by the ' + rejectedBy + '.</p>';

  htmlBody += '<div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">';
  htmlBody += '<h2 style="color: #dc3545; border-bottom: 2px solid #dc3545; padding-bottom: 10px;">Application Details</h2>';
  htmlBody += '<table style="width: 100%; border-collapse: collapse;">';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Destination:</td><td style="padding: 8px;">' + formData.destination + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Date:</td><td style="padding: 8px;">' + formatEmailDate(formData.trip_date) + '</td></tr>';
  htmlBody += '</table>';
  htmlBody += '</div>';

  if (comments) {
    htmlBody += '<div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">';
    htmlBody += '<h3 style="margin-top: 0; color: #721c24;">Comments</h3>';
    htmlBody += '<p style="margin: 0;">' + comments + '</p>';
    htmlBody += '</div>';
  }

  htmlBody += '<p>If you have questions or would like to discuss this decision, please contact your administrator.</p>';
  htmlBody += '</div>';

  htmlBody += '<div style="background: #e9ecef; padding: 15px; text-align: center; font-size: 12px; color: #6c757d;">';
  htmlBody += '<p>Owen D. Young Central School District - Field Trip Management System</p>';
  htmlBody += '</div>';
  htmlBody += '</div>';

  try {
    MailApp.sendEmail({
      to: formData.email,
      subject: 'Field Trip Application - Decision',
      htmlBody: htmlBody
    });
  } catch (error) {
    Logger.log('Error sending rejection email: ' + error);
    notifySystemError('sendRejectionEmail (#' + formData.submission_number + ')', error);
  }
}

/**
 * Sends final approval email to submitter
 * @param {Object} formData - The submission data
 * @param {string} comments - District admin comments
 * @param {Object} approvalDoc - The approval document (optional)
 */
function sendFinalApprovalEmail(formData, comments, approvalDoc) {
  var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">';
  htmlBody += '<div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; text-align: center;">';
  htmlBody += '<h1 style="margin: 0;">✓ Field Trip Application Approved!</h1>';
  htmlBody += '</div>';

  htmlBody += '<div style="padding: 20px; background: #f8f9fa;">';
  htmlBody += '<p>Dear ' + formData.adult_in_charge + ',</p>';
  htmlBody += '<p>Congratulations! Your field trip application has been fully approved.</p>';

  htmlBody += '<div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">';
  htmlBody += '<h2 style="color: #28a745; border-bottom: 2px solid #28a745; padding-bottom: 10px;">Trip Details</h2>';
  htmlBody += '<table style="width: 100%; border-collapse: collapse;">';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Destination:</td><td style="padding: 8px;">' + formData.destination + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Date:</td><td style="padding: 8px;">' + formatEmailDate(formData.trip_date) + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Departure:</td><td style="padding: 8px;">' + formData.leave_school + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Return:</td><td style="padding: 8px;">' + formData.arrive_school + '</td></tr>';
  htmlBody += '</table>';
  htmlBody += '</div>';

  // Show building admin comments if available
  if (formData.building_comments && formData.building_comments.trim()) {
    htmlBody += '<div style="background: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin: 20px 0;">';
    htmlBody += '<h3 style="margin-top: 0; color: #0c5460;">Building Administrator Comments</h3>';
    htmlBody += '<p style="margin: 0;">' + formData.building_comments + '</p>';
    htmlBody += '</div>';
  }

  // Show district admin comments if available
  if (comments && comments.trim()) {
    htmlBody += '<div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">';
    htmlBody += '<h3 style="margin-top: 0; color: #155724;">District Administrator Comments</h3>';
    htmlBody += '<p style="margin: 0;">' + comments + '</p>';
    htmlBody += '</div>';
  }

  if (approvalDoc) {
    htmlBody += '<p><strong>Your approval document is attached.</strong> Please print and keep for your records.</p>';
  }

  htmlBody += '<div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">';
  htmlBody += '<h3 style="margin-top: 0; color: #856404;">Next Steps</h3>';
  htmlBody += '<ul style="margin: 0; padding-left: 20px;">';
  htmlBody += '<li>Review the attached approval document</li>';
  htmlBody += '<li>Submit any required permission slips</li>';
  htmlBody += '<li>Confirm transportation arrangements</li>';
  htmlBody += '<li>Have a great trip!</li>';
  htmlBody += '</ul>';
  htmlBody += '</div>';

  htmlBody += '</div>';

  htmlBody += '<div style="background: #e9ecef; padding: 15px; text-align: center; font-size: 12px; color: #6c757d;">';
  htmlBody += '<p>Owen D. Young Central School District - Field Trip Management System</p>';
  htmlBody += '</div>';
  htmlBody += '</div>';

  var emailOptions = {
    to: formData.email,
    subject: 'APPROVED: Field Trip to ' + formData.destination,
    htmlBody: htmlBody
  };

  if (approvalDoc) {
    emailOptions.attachments = [approvalDoc.getAs(MimeType.PDF)];
  }

  try {
    MailApp.sendEmail(emailOptions);
  } catch (error) {
    Logger.log('Error sending final approval email: ' + error);
    notifySystemError('sendFinalApprovalEmail (#' + formData.submission_number + ')', error);
  }
}

/**
 * Sends notification to bus garage about transportation needs
 * @param {Object} formData - The submission data
 */
function sendBusGarageNotification(formData) {
  var settings = getSettings();

  if (!settings.FINAL_EMAIL) {
    return; // No bus garage email configured
  }

  var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">';
  htmlBody += '<h2>Field Trip Transportation Request</h2>';
  htmlBody += '<p>A field trip has been approved that requires school bus transportation.</p>';

  htmlBody += '<table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">';
  htmlBody += '<tr><th style="padding: 10px; background: #f0f0f0; text-align: left; border: 1px solid #ddd;">Field</th><th style="padding: 10px; background: #f0f0f0; text-align: left; border: 1px solid #ddd;">Details</th></tr>';
  htmlBody += '<tr><td style="padding: 10px; border: 1px solid #ddd;">Date</td><td style="padding: 10px; border: 1px solid #ddd;">' + formatEmailDate(formData.trip_date) + '</td></tr>';
  htmlBody += '<tr><td style="padding: 10px; border: 1px solid #ddd;">Destination</td><td style="padding: 10px; border: 1px solid #ddd;">' + formData.destination + '</td></tr>';
  htmlBody += '<tr><td style="padding: 10px; border: 1px solid #ddd;">Building</td><td style="padding: 10px; border: 1px solid #ddd;">' + formData.building + '</td></tr>';
  htmlBody += '<tr><td style="padding: 10px; border: 1px solid #ddd;">Teacher</td><td style="padding: 10px; border: 1px solid #ddd;">' + formData.adult_in_charge + '</td></tr>';
  htmlBody += '<tr><td style="padding: 10px; border: 1px solid #ddd;">Students</td><td style="padding: 10px; border: 1px solid #ddd;">' + formData.num_students + '</td></tr>';
  htmlBody += '<tr><td style="padding: 10px; border: 1px solid #ddd;">Adults</td><td style="padding: 10px; border: 1px solid #ddd;">' + formData.num_adults + '</td></tr>';
  htmlBody += '<tr><td style="padding: 10px; border: 1px solid #ddd;">Departure</td><td style="padding: 10px; border: 1px solid #ddd;">' + formData.leave_school + '</td></tr>';
  htmlBody += '<tr><td style="padding: 10px; border: 1px solid #ddd;">Return</td><td style="padding: 10px; border: 1px solid #ddd;">' + formData.arrive_school + '</td></tr>';
  htmlBody += '</table>';

  htmlBody += '<p>Please schedule appropriate transportation for this trip.</p>';
  htmlBody += '</div>';

  try {
    MailApp.sendEmail({
      to: settings.FINAL_EMAIL,
      subject: 'Field Trip Transportation Request - ' + formatEmailDate(formData.trip_date),
      htmlBody: htmlBody
    });
  } catch (error) {
    Logger.log('Error sending bus garage notification: ' + error);
    notifySystemError('sendBusGarageNotification (#' + formData.submission_number + ')', error);
  }
}

/**
 * Parses lunch_names' "---"-separated blob back into { optionName: [names...] }.
 * Mirrors FormNew.html's client-side parseLunchNames() - same delimiter format,
 * chosen because it survives sanitizeInput()'s HTML-entity escaping untouched.
 * @param {string} str
 * @returns {Object}
 */
function parseLunchNamesString(str) {
  var result = {};
  if (!str) return result;

  var current = null;
  var lines = str.split('\n');

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line === '---') {
      current = null;
    } else if (current === null) {
      current = line;
      result[current] = [];
    } else if (line.trim()) {
      result[current].push(line.trim());
    }
  }

  return result;
}

/**
 * Builds the recipient list for a building's lunch-related emails: that
 * building's lunch manager plus the district-wide central contact, deduped,
 * skipping either if unconfigured.
 * @param {Object} formData - The submission data
 * @param {Object} settings - Already-loaded _Settings map
 * @returns {string[]}
 */
function getLunchRecipients(formData, settings) {
  var recipients = [];
  var buildingLunchEmail = settings[formData.building + '_LUNCH_EMAIL'];
  if (buildingLunchEmail) {
    recipients.push(buildingLunchEmail);
  }
  if (settings.LUNCH_CENTRAL_EMAIL && recipients.indexOf(settings.LUNCH_CENTRAL_EMAIL) === -1) {
    recipients.push(settings.LUNCH_CENTRAL_EMAIL);
  }
  return recipients;
}

/**
 * Sends lunch totals and name lists to the building's lunch manager and/or the
 * central lunch contact, once a teacher actually submits real counts (see
 * LunchHandlers.js's submitLunchCounts) - not tied to trip approval at all,
 * since counts are usually entered well after submission and independently of
 * the approval workflow.
 * @param {Object} formData - The submission data (with lunch_names already populated)
 * @param {Object} settings - Already-loaded _Settings map
 */
function sendLunchCountsNotification(formData, settings) {
  var recipients = getLunchRecipients(formData, settings);
  if (!recipients.length) {
    return; // No lunch email configured for this building or centrally
  }

  var lunchDashboardUrl = ScriptApp.getService().getUrl() + '?lunchDashboard=1';
  var namesByOption = parseLunchNamesString(formData.lunch_names);

  var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">';
  htmlBody += '<h2>Field Trip Lunch Request</h2>';
  htmlBody += '<p>A field trip has submitted its final school-provided lunch counts.</p>';

  htmlBody += '<table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">';
  htmlBody += '<tr><th style="padding: 10px; background: #f0f0f0; text-align: left; border: 1px solid #ddd;">Field</th><th style="padding: 10px; background: #f0f0f0; text-align: left; border: 1px solid #ddd;">Details</th></tr>';
  htmlBody += '<tr><td style="padding: 10px; border: 1px solid #ddd;">Date</td><td style="padding: 10px; border: 1px solid #ddd;">' + formatEmailDate(formData.trip_date) + '</td></tr>';
  htmlBody += '<tr><td style="padding: 10px; border: 1px solid #ddd;">Building</td><td style="padding: 10px; border: 1px solid #ddd;">' + formData.building + '</td></tr>';
  htmlBody += '<tr><td style="padding: 10px; border: 1px solid #ddd;">Teacher</td><td style="padding: 10px; border: 1px solid #ddd;">' + formData.adult_in_charge + '</td></tr>';
  htmlBody += '</table>';

  htmlBody += '<h3>Lunch Totals</h3>';
  for (var optionName in namesByOption) {
    var names = namesByOption[optionName];
    htmlBody += '<p><strong>' + optionName + ': ' + names.length + '</strong></p>';
    if (names.length) {
      htmlBody += '<ul>';
      for (var i = 0; i < names.length; i++) {
        htmlBody += '<li>' + names[i] + '</li>';
      }
      htmlBody += '</ul>';
    }
  }

  htmlBody += '<p style="margin-top: 20px;"><a href="' + lunchDashboardUrl + '" style="font-weight: bold;">View in Lunch Dashboard</a></p>';
  htmlBody += '</div>';

  try {
    MailApp.sendEmail({
      to: recipients.join(','),
      subject: 'Field Trip Lunch Counts - ' + formatEmailDate(formData.trip_date),
      htmlBody: htmlBody
    });
  } catch (error) {
    Logger.log('Error sending lunch counts notification: ' + error);
    notifySystemError('sendLunchCountsNotification (#' + formData.submission_number + ')', error);
  }
}

/**
 * Tells the building's lunch manager and/or central contact that a trip they'd
 * already received real counts for has since been rejected/cancelled - called
 * only when lunch_status was already 'Counts Provided' at the time of rejection
 * (FormHandlers.js), since nothing needs retracting if they were never told.
 * @param {Object} formData - The submission data
 * @param {Object} settings - Already-loaded _Settings map
 */
function sendLunchCancelledNotification(formData, settings) {
  var recipients = getLunchRecipients(formData, settings);
  if (!recipients.length) {
    return;
  }

  var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">';
  htmlBody += '<h2>Field Trip Lunch Request Cancelled</h2>';
  htmlBody += '<p>A field trip you previously received lunch counts for has been rejected/cancelled - no lunch is needed.</p>';
  htmlBody += '<table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">';
  htmlBody += '<tr><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Date</td><td style="padding: 10px; border: 1px solid #ddd;">' + formatEmailDate(formData.trip_date) + '</td></tr>';
  htmlBody += '<tr><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Building</td><td style="padding: 10px; border: 1px solid #ddd;">' + formData.building + '</td></tr>';
  htmlBody += '<tr><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Teacher</td><td style="padding: 10px; border: 1px solid #ddd;">' + formData.adult_in_charge + '</td></tr>';
  htmlBody += '</table>';
  htmlBody += '<p style="margin-top: 20px;"><a href="' + ScriptApp.getService().getUrl() + '?lunchDashboard=1" style="font-weight: bold;">View in Lunch Dashboard</a></p>';
  htmlBody += '</div>';

  try {
    MailApp.sendEmail({
      to: recipients.join(','),
      subject: 'Field Trip Lunch Request Cancelled - ' + formatEmailDate(formData.trip_date),
      htmlBody: htmlBody
    });
  } catch (error) {
    Logger.log('Error sending lunch cancelled notification: ' + error);
    notifySystemError('sendLunchCancelledNotification (#' + formData.submission_number + ')', error);
  }
}

/**
 * Reminds the submitting teacher that lunch counts are still missing as the
 * trip date approaches. Sent by DigestService.js's sendLunchCountReminders.
 * @param {Object} formData - The submission data
 */
function sendLunchCountReminderEmail(formData) {
  var lunchEntryUrl = ScriptApp.getService().getUrl() + '?idNum=' + formData.submission_number + '&action=lunchEntry';

  var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">';
  htmlBody += '<h2>Reminder: School Lunch Counts Needed</h2>';
  htmlBody += '<p>Your field trip to ' + formData.destination + ' on ' + formatEmailDate(formData.trip_date) + ' requested school-provided lunch, but counts haven\'t been submitted yet.</p>';
  htmlBody += '<p>The Food Services Department needs at least a week\'s notice to guarantee orders can be processed - please submit your counts soon:</p>';
  htmlBody += '<p><a href="' + lunchEntryUrl + '" style="font-weight: bold;">Submit Lunch Counts</a></p>';
  htmlBody += '</div>';

  try {
    MailApp.sendEmail({
      to: formData.email,
      subject: 'Reminder: Submit Lunch Counts for ' + formatEmailDate(formData.trip_date),
      htmlBody: htmlBody
    });
  } catch (error) {
    Logger.log('Error sending lunch count reminder: ' + error);
    notifySystemError('sendLunchCountReminderEmail (#' + formData.submission_number + ')', error);
  }
}
