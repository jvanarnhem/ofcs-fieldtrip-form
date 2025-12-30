/*  Code source: https://github.com/hadaf
 *  This is the main method that should be invoked.
 *  Copy and paste the ID of your template Doc in the first line of this method.
 *
 *  Make sure the first row of the data Sheet is column headers.
 *
 *  Reference the column headers in the template by enclosing the header in square brackets.
 *  Example: "This is [header1] that corresponds to a value of [header2]."
 */
function doPreMerge(subNumber, adultInCharge, folderID, spreadsheetID, templateID) {
  var selectedTemplateId = templateID;

  var templateFile = DriveApp.getFileById(selectedTemplateId);
  var targetFolder = DriveApp.getFolderById(folderID);
  var mergedFile = templateFile.makeCopy(targetFolder); //make a copy of the template file to use for the merged File.
  // Note: It is necessary to make a copy upfront, and do the rest of the content manipulation inside this single copied file,
  // otherwise, if the destination file and the template file are separate, a Google bug will prevent copying of images from the
  // template to the destination. See the description of the bug here: https://code.google.com/p/google-apps-script-issues/issues/detail?id=1612#c14
  mergedFile.setName(subNumber + " Field Trip Application for " + adultInCharge);//give a custom name to the new file (otherwise it is called "copy of ...")
  var mergedDoc = DocumentApp.openById(mergedFile.getId());
  var bodyElement = mergedDoc.getBody();//the body of the merged document, which is at this point the same as the template doc.

  // Use the active spreadsheet (the one this script is bound to) instead of opening by ID
  // This ensures we always read from the correct spreadsheet
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  // Get data from Submissions sheet
  var submissionsSheet = spreadsheet.getSheetByName('Submissions');

  if (!submissionsSheet) {
    Logger.log('Submissions sheet not found');
    mergedDoc.saveAndClose();
    return mergedDoc;
  }

  var data = submissionsSheet.getDataRange().getValues();
  var fieldNames = data[0];
  var rowFound = null;

  Logger.log('PreMerge: Searching for submission number: ' + subNumber + ' (type: ' + typeof subNumber + ')');
  Logger.log('PreMerge: Total rows in sheet: ' + data.length);

  // Find the submission
  for (var i = 1; i < data.length; i++) {
    Logger.log('PreMerge: Checking row ' + i + ', column 0 value: ' + data[i][0] + ' (type: ' + typeof data[i][0] + ')');
    if (data[i][0] == subNumber) {
      rowFound = data[i];
      Logger.log('PreMerge: Found matching submission at row ' + i);
      break;
    }
  }

  if (!rowFound) {
    Logger.log('Could not find data for submission: ' + subNumber);
    Logger.log('PreMerge: Checked all ' + (data.length - 1) + ' data rows without finding a match');
    mergedDoc.saveAndClose();
    return mergedDoc;
  }

  // Now do the merge replacements directly in the document body
  Logger.log('Found submission ' + subNumber + ', performing initial merge...');

  for (var f = 0; f < fieldNames.length; f++) {
    var fieldValue = rowFound[f];

    // Convert to string, handling null/undefined
    if (fieldValue === null || fieldValue === undefined) {
      fieldValue = '';
    } else if (fieldValue instanceof Date) {
      // Format dates nicely
      fieldValue = Utilities.formatDate(fieldValue, Session.getScriptTimeZone(), 'MMM. d, yyyy');
    } else {
      fieldValue = String(fieldValue);
    }

    // Replace [FieldName] with the value
    var placeholder = "\\[" + fieldNames[f] + "\\]";
    bodyElement.replaceText(placeholder, fieldValue);
    Logger.log('Replaced [' + fieldNames[f] + '] with: ' + fieldValue);
  }

  // Replace [Today] with current date
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMM. d, yyyy");
  bodyElement.replaceText("\\[Today\\]", today);

  mergedDoc.saveAndClose();
  Logger.log('Initial merge completed successfully');
  return mergedDoc;
}



