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
  var bodyCopy = bodyElement.copy();//make a copy of the body
  
  bodyElement.clear();//clear the body of the mergedDoc so that we can write the new data in it.
  
  var sheet = SpreadsheetApp.openById(spreadsheetID);

  var rows = sheet.getDataRange();
  var numRows = rows.getNumRows();
  var values = rows.getValues();
  var fieldNames = values[0];//First row of the sheet must be the the field names

  var data = sheet.getDataRange().getValues();
  
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] == subNumber) {
      var row = values[i];
      var body = bodyCopy.copy();
    
      for (var f = 0; f < fieldNames.length; f++) {
        body.replaceText("\\[" + fieldNames[f] + "\\]", row[f]);//replace [fieldName] with the respective data value
      }
    
      var date = Utilities.formatDate(new Date(), "EST", "MM-dd-yyyy");
      body.replaceText("\\[Today\\]", date);
      var numChildren = body.getNumChildren();//number of the contents in the template doc
     
      for (var c = 0; c < numChildren; c++) {//Go over all the content of the template doc, and replicate it for each row of the data.
        var child = body.getChild(c);
        child = child.copy();
        if (child.getType() == DocumentApp.ElementType.HORIZONTALRULE) {
          mergedDoc.appendHorizontalRule(child);
        } else if (child.getType() == DocumentApp.ElementType.INLINEIMAGE) {
          mergedDoc.appendImage(child.getBlob());
        } else if (child.getType() == DocumentApp.ElementType.PARAGRAPH) {
          mergedDoc.appendParagraph(child);
        } else if (child.getType() == DocumentApp.ElementType.LISTITEM) {
          mergedDoc.appendListItem(child);
        } else if (child.getType() == DocumentApp.ElementType.TABLE) {
          mergedDoc.appendTable(child);
        } else {
          Logger.log("Unknown element type: " + child);
        }
      }
      break;
    }
  };
    
  mergedDoc.saveAndClose();
  return mergedDoc;
}



