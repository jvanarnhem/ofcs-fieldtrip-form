/**
 * Email Service
 * Handles all email notifications for the field trip workflow
 */

/**
 * Sends notification to building administrator when form is submitted
 * @param {number} submissionNumber - Unique submission ID
 * @param {Object} formData - The submission data
 * @param {string} adminEmail - Building admin email
 * @param {string} adminName - Building admin name
 */
function sendBuildingAdminNotification(submissionNumber, formData, adminEmail, adminName) {
  var approvalUrl = ScriptApp.getService().getUrl() +
    '?idNum=' + submissionNumber + '&buildapprove=1';

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
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Date:</td><td style="padding: 8px;">' + formData.trip_date + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Teacher:</td><td style="padding: 8px;">' + formData.adult_in_charge + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Students:</td><td style="padding: 8px;">' + formData.num_students + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Grade Level:</td><td style="padding: 8px;">' + formData.grade_level + '</td></tr>';
  htmlBody += '</table>';
  htmlBody += '</div>';

  htmlBody += '<div style="text-align: center; margin: 30px 0;">';
  htmlBody += '<a href="' + approvalUrl + '" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">Review Application</a>';
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
  }
}

/**
 * Sends confirmation email to the person who submitted the form
 * @param {number} submissionNumber - Unique submission ID
 * @param {Object} formData - The submission data
 */
function sendSubmitterConfirmation(submissionNumber, formData) {
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
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Date:</td><td style="padding: 8px;">' + formData.trip_date + '</td></tr>';
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

  htmlBody += '<p style="color: #6c757d;">If you have any questions or need to make changes to your application, please contact your building administrator.</p>';
  htmlBody += '</div>';

  htmlBody += '<div style="background: #e9ecef; padding: 15px; text-align: center; font-size: 12px; color: #6c757d;">';
  htmlBody += '<p>Owen D. Young Central School District - Field Trip Management System</p>';
  htmlBody += '</div>';
  htmlBody += '</div>';

  try {
    MailApp.sendEmail({
      to: formData.email,
      subject: 'CONFIRMATION: Field Trip Application #' + submissionNumber,
      htmlBody: htmlBody
    });
  } catch (error) {
    Logger.log('Error sending submitter confirmation: ' + error);
  }
}

/**
 * Sends notification to district administrator after building admin approves
 * @param {number} submissionNumber - Unique submission ID
 * @param {Object} formData - The submission data
 * @param {string} buildingComments - Comments from building admin
 * @param {string} districtEmail - District admin email
 */
function sendDistrictAdminNotification(submissionNumber, formData, buildingComments, districtEmail) {
  var approvalUrl = ScriptApp.getService().getUrl() +
    '?idNum=' + submissionNumber + '&buildapprove=2';

  var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">';
  htmlBody += '<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">';
  htmlBody += '<h1 style="margin: 0;">Field Trip Application - Building Approved</h1>';
  htmlBody += '</div>';

  htmlBody += '<div style="padding: 20px; background: #f8f9fa;">';
  htmlBody += '<p>A field trip application has been approved by the building administrator and requires district-level review.</p>';

  htmlBody += '<div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">';
  htmlBody += '<h2 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px;">Application Summary</h2>';
  htmlBody += '<table style="width: 100%; border-collapse: collapse;">';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Submission #:</td><td style="padding: 8px;">' + submissionNumber + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Destination:</td><td style="padding: 8px;">' + formData.destination + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Date:</td><td style="padding: 8px;">' + formData.trip_date + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Teacher:</td><td style="padding: 8px;">' + formData.adult_in_charge + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Building:</td><td style="padding: 8px;">' + formData.building + '</td></tr>';
  htmlBody += '</table>';
  htmlBody += '</div>';

  if (buildingComments) {
    htmlBody += '<div style="background: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin: 20px 0;">';
    htmlBody += '<h3 style="margin-top: 0; color: #0c5460;">Building Administrator Comments</h3>';
    htmlBody += '<p style="margin: 0;">' + buildingComments + '</p>';
    htmlBody += '</div>';
  }

  htmlBody += '<div style="text-align: center; margin: 30px 0;">';
  htmlBody += '<a href="' + approvalUrl + '" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">Review Application</a>';
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
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Date:</td><td style="padding: 8px;">' + formData.trip_date + '</td></tr>';
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
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Date:</td><td style="padding: 8px;">' + formData.trip_date + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Departure:</td><td style="padding: 8px;">' + formData.leave_school + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px; font-weight: bold;">Return:</td><td style="padding: 8px;">' + formData.arrive_school + '</td></tr>';
  htmlBody += '</table>';
  htmlBody += '</div>';

  if (comments) {
    htmlBody += '<div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">';
    htmlBody += '<h3 style="margin-top: 0; color: #155724;">Administrator Comments</h3>';
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
  }
}

/**
 * Sends notification to bus garage about transportation needs
 * @param {Object} formData - The submission data
 */
function sendBusGarageNotification(formData) {
  var settings = getSettings();

  if (!settings.BUS_GARAGE_EMAIL) {
    return; // No bus garage email configured
  }

  var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">';
  htmlBody += '<h2>Field Trip Transportation Request</h2>';
  htmlBody += '<p>A field trip has been approved that requires school bus transportation.</p>';

  htmlBody += '<table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">';
  htmlBody += '<tr><th style="padding: 10px; background: #f0f0f0; text-align: left; border: 1px solid #ddd;">Field</th><th style="padding: 10px; background: #f0f0f0; text-align: left; border: 1px solid #ddd;">Details</th></tr>';
  htmlBody += '<tr><td style="padding: 10px; border: 1px solid #ddd;">Date</td><td style="padding: 10px; border: 1px solid #ddd;">' + formData.trip_date + '</td></tr>';
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
      to: settings.BUS_GARAGE_EMAIL,
      subject: 'Field Trip Transportation Request - ' + formData.trip_date,
      htmlBody: htmlBody
    });
  } catch (error) {
    Logger.log('Error sending bus garage notification: ' + error);
  }
}
