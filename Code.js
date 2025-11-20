var SPREADSHEET_ID = '1Tuas-Xy8RhpPhQljk5j4W-RTW_c4zUd6aFUNDY13WDI'; // Replace with your spreadsheet ID

var CACHE_PROP = CacheService.getPublicCache();
var ss = SpreadsheetApp.getActiveSpreadsheet(); //SpreadsheetApp.openById(SPREADSHEET_ID);
var SETTINGS_SHEET = "_Settings";
var CACHE_SETTINGS = false;
var SETTINGS_CACHE_TTL = 900;
var cache = JSONCacheService();
var SETTINGS = getSettings();
var subSheet = ss.getSheetByName("Submissions");
var compSheet = ss.getSheetByName("Completed");

// Consider new way to differentiate files.
function doGet(e) {
  var buildingApproved = e.parameter.buildapprove;
  var idVal = e.parameter.idNum;
  
  if (buildingApproved == 2) {
    var template = HtmlService.createTemplateFromFile("districtAdmin.html");
    var data = subSheet.getDataRange().getValues();
    
    for (var i in data) {
      if (data[i][0] == idVal) {
        template.info = data[i];
        break;
      }
    };
  } else if (buildingApproved == 1){
    var template = HtmlService.createTemplateFromFile("buildAdmin.html");
    var data = subSheet.getDataRange().getValues();
    
    for (var i in data) {
      if (data[i][0] == idVal) {
        template.info = data[i];
        break;
      }
    };
    if (!template.info) {
      template = HtmlService.createTemplateFromFile("DoneAlready.html");
      //return "Something went wrong.";
    }
  } else if (buildingApproved == 0) {
    update(idVal, 0, "");
    return ContentService.createTextOutput("Rejected!");
  } else {
    var template = HtmlService.createTemplateFromFile("forms.html");
  }
  
  var html = template.evaluate();
  var output =  HtmlService.createHtmlOutput(html).setTitle("OFCS Field Trip Application");
  //output.setFaviconUrl('https://ofhsmath.com/online_forms/images/Waverly.png')
  return output;
}

//***********************************************************************************************************************************************
function submitReport(data) { 
  var data3 = JSON.parse(data);
  var blding = data3.building;
  var adminemail = "ofcsdistrict@ofcs.net";
  var adminname = "Admin Name";
  if (blding == "HS") {
    adminemail = SETTINGS.HS_EMAIL;
    adminname = SETTINGS.HS_ADMIN;
  } else if (blding == "MS") {
    adminemail = SETTINGS.MS_EMAIL;
    adminname = SETTINGS.MS_ADMIN;
  } else if (blding == "IS") {
    adminemail = SETTINGS.IS_EMAIL;
    adminname = SETTINGS.IS_ADMIN;
  } else if (blding == "FL") {
    adminemail = SETTINGS.FL_EMAIL;
    adminname = SETTINGS.FL_ADMIN;
  } else if (blding == "ECC") {
    adminemail = SETTINGS.ECC_EMAIL;
    adminname = SETTINGS.ECC_ADMIN;
  }
  else {
    adminemail = SETTINGS.DISTRICT_EMAIL;
  }
  try {
    //data3.dateOfIncident = "'" + data3.dateOfIncident.toLocaleDateString('en-US');
    //data3.timeOfIncident = data3.timeOfIncident.toHHMM();
    var newStuff = [];
    var subNumber = +new Date();
    var timeStamp = new Date();
    timeStamp = "'" + timeStamp.toLocaleDateString('en-US');
    
  //var myDateArray = data3.tripdate.split("-");
  var dateOfTrip = new Date(data3.tripdate);
  var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var dayOfWeek = days[dateOfTrip.getDay()];
  dateOfTrip = "'" + dateOfTrip.toLocaleDateString('en-US');
  var leave1 = data3.leaveschool.toHHMM();
  var arrive1 = data3.arrivedestination.toHHMM();
  var leave2 = data3.leavedestination.toHHMM();
  var arrive2 = data3.arriveschool.toHHMM();
  
    newStuff.push(subNumber);
    newStuff.push(timeStamp);
    newStuff.push(dayOfWeek);
    for (var i in data3) {
      if(i != data3.length) {
        if(typeof data3[i]=="object"){
          var dataString = data3[i].join(", ");
          newStuff.push(dataString);
        } else {
          newStuff.push(data3[i]);
        }
      }      
    }
   
    newStuff.push("-----");
    newStuff[4] = dateOfTrip;
    newStuff[17] = leave1;
    newStuff[18] = arrive1;
    newStuff[19] = leave2;
    newStuff[20] = arrive2;
    newStuff.push(adminname);
    subSheet.appendRow(newStuff);
    
    var htmlBody = "<h2>Field Trip Application Submitted. </h2>";
    htmlBody += '<p><strong>Click <a href="' + ScriptApp.getService().getUrl()
       + '?idNum=' + subNumber + '&buildapprove=1'
       + '">on this link</a> to see full details of referral and to add administrative feedback.</strong></p>';
    htmlBody += "<p>&nbsp;</p>";
    htmlBody += "<h4>Summary: </h4>";
    htmlBody += "<p>Destination: " + data3['destination']  + "<br>";
    htmlBody += "Date of Trip: " + data3['tripdate']  + "<br>";
    htmlBody += "Date submitted: " + timeStamp + "<br>";
    htmlBody += "Submitted By: " + data3['adultincharge']  + "</p>";    
 
 // CHANGE EMAIL ADDRESS HERE to "adminemail"  
    MailApp.sendEmail({
      to: adminemail,
      subject: "ACTION REQUIRED: Field Trip Application " + " #" + subNumber,
      htmlBody: htmlBody
    });
    update(subNumber, 1, "");
    
    var submitDoc = doPreMerge(subNumber, data3['adultincharge'], SETTINGS.INITIAL_SUB_FOLDER_ID, SETTINGS.SPREADSHEET_ID, SETTINGS.TEMPLATE_INIT_ID);
    var recipient = data3.email;
    var htmlBody2 = "<p>Thank you for your field trip application submission.</p>";
    htmlBody2 += "<p>If you do not receive a confirmation email in a few days, please follow up with your building administrator.</p>";
    htmlBody2 += "<p>A copy of the information you submitted in your application is attached.</p>";
    MailApp.sendEmail({
      to: recipient,
      subject: "CONFIRMATION: Field Trip Application " + " #" + subNumber,
      htmlBody: htmlBody2,
      attachments: [submitDoc.getAs(MimeType.PDF)]
    });
    
    return "Submission successful. You may close this window now.";
    
  } catch(err) {
    return "Something went wrong.";
  }
}

//***********************************************************************************************************************************************
function approveSubmission1 (data) {
  Logger.log("approved 1");
  var data3 = JSON.parse(data);
  update(data3['subNum'], 2, data3['buildcomments'], "");
  try {
    var htmlBody = "<h2>Field Trip Application Submitted. </h2>";
    htmlBody += '<p><strong>Click <a href="' + ScriptApp.getService().getUrl()
       + '?idNum=' + data3['subNum'] + '&buildapprove=2'
       + '">on this link</a> to see full details of referral and to add administrative feedback.</strong></p>';
    htmlBody += "<p>&nbsp;</p>";
    htmlBody += "<h4>Summary: </h4>";
    htmlBody += "<p>Destination: " + data3['destination']  + "<br>";
    htmlBody += "Date of Trip: " + data3['tripdate']  + "<br>";
    htmlBody += "Date submitted: " + data3['timeStamp'] + "<br>";
    htmlBody += "Submitted By: " + data3['adultincharge']  + "<br>";
    htmlBody += "Building Admin Comments: " + data3['buildcomments'] + "</p>";
 
 // CHANGE EMAIL ADDRESS HERE to "adminemail"  
    MailApp.sendEmail({
      to: SETTINGS.DISTRICT_EMAIL,
      subject: "ACTION REQUIRED: Field Trip Application " + " #" + data3['subNum'],
      htmlBody: htmlBody
    });
    
    return "Submission successful. You may close this window now.";
    
  } catch(err) {
    return "Something went wrong.";
  }
}
//***********************************************************************************************************************************************
function approveSubmission2 (data) {
  Logger.log("approved 2");
  var data3 = JSON.parse(data);
  
  try {
    var finishedDoc = doMerge(data3['subNum'], data3['adultincharge'], SETTINGS.DESTINATION_FOLDER_ID, SETTINGS.SPREADSHEET_ID, SETTINGS.TEMPLATE_ID);
    var docURL = finishedDoc.getUrl();
    update(data3['subNum'], 3, data3['districtcomments'], docURL);
    
    var htmlBody = "<h2>Field Trip Application Approved. </h2>";
    htmlBody += "<p>&nbsp;</p>";
    htmlBody += "<h4>Summary: </h4>";
    htmlBody += "<p>Destination: " + data3['destination']  + "<br>";
    htmlBody += "Date of Trip: " + data3['tripdate']  + "<br>";
    htmlBody += "Date submitted: " + data3['timeStamp'] + "<br>";
    htmlBody += "Submitted By: " + data3['adultincharge']  + "<br>";
    htmlBody += "Building Admin Comments: " + data3['buildcomments'] + "<br>";
    htmlBody += "District Admin Comments: " + data3['districtcomments'] + "</p>";
 
 // CHANGE EMAIL ADDRESS HERE to "adminemail"
    MailApp.sendEmail({
      to: SETTINGS.FINAL_EMAIL,
      subject: "APPROVED: Field Trip Application " + " #" + data3['subNum'],
      htmlBody: htmlBody,
      attachments: [finishedDoc.getAs(MimeType.PDF)]
    });
    
    moveApproved();
    
    var recipient = data3.email;
    var htmlBody2 = "<p>Your field trip application has been approved.</p>";
    htmlBody2 += "<h4>Summary: </h4>";
    htmlBody2 += "<p>Destination: " + data3['destination']  + "<br>";
    htmlBody2 += "Date of Trip: " + data3['tripdate']  + "<br>";
    htmlBody2 += "Date submitted: " + data3['timeStamp'] + "<br>";
    htmlBody2 += "Submitted By: " + data3['adultincharge']  + "<br>";
    htmlBody2 += "Building Admin Comments: " + data3['buildcomments'] + "<br>";
    htmlBody2 += "District Admin Comments: " + data3['districtcomments'] + "</p>";
    MailApp.sendEmail({
      to: recipient,
      subject: "APPROVED: Field Trip Application " + " #" + data3['subNum'],
      htmlBody: htmlBody2,
      attachments: [finishedDoc.getAs(MimeType.PDF)]
    });
    
    addToCalendar(data3, SETTINGS.CALENDAR_NAME, docURL);
    
    return "Submission successful. You may close this window now.";
    
  } catch(err) {
    return "Something went wrong.";
  }
}
//***********************************************************************************************************************************************
function rejectSubmission1 (data) {
  Logger.log("rejected 1");
  var data3 = JSON.parse(data);
  update(data3['subNum'], -2, data3['buildcomments'],"");
  try {
    var recipient = data3.email;
    var htmlBody = "<h2>Field Trip Application Rejected by Building Administrator. </h2>";
    htmlBody += "<p>If you have questions regarding the non-approval of this application, please contact your building administrator.</p>";
    htmlBody += "<p>&nbsp;</p>";
    htmlBody += "<h4>Summary: </h4>";
    htmlBody += "<p>Destination: " + data3['destination']  + "<br>";
    htmlBody += "Date of Trip: " + data3['tripdate']  + "<br>";
    htmlBody += "Date submitted: " + data3['timeStamp'] + "<br>";
    htmlBody += "Submitted By: " + data3['adultincharge']  + "<br>";
    htmlBody += "Building Admin Comments: " + data3['buildcomments'] + "<br>";
 
 // CHANGE EMAIL ADDRESS HERE to "adminemail"  
    MailApp.sendEmail({
      to: recipient,
      subject: "ATTENTION: Field Trip Application Information" + " #" + data3['subNum'],
      htmlBody: htmlBody
    });
    
    moveApproved();
    return "Submission successful. You may close this window now.";
    
  } catch(err) {
    return "Something went wrong.";
  }
}
//***********************************************************************************************************************************************
function rejectSubmission2 (data) {
  Logger.log("rejected 2");
  var data3 = JSON.parse(data);
  update(data3['subNum'], -3, data3['districtcomments'],"");
  try {
    var recipient = data3.email;
    var htmlBody = "<h2>Field Trip Application Rejected by District Administrator. </h2>";
    htmlBody += "<p>If you have questions regarding the non-approval of this application, please contact your building administrator.</p>";
    htmlBody += "<p>&nbsp;</p>";
    htmlBody += "<h4>Summary: </h4>";
    htmlBody += "<p>Destination: " + data3['destination']  + "<br>";
    htmlBody += "Date of Trip: " + data3['tripdate']  + "<br>";
    htmlBody += "Date submitted: " + data3['timeStamp'] + "<br>";
    htmlBody += "Submitted By: " + data3['adultincharge']  + "<br>";
    htmlBody += "Building Admin Comments: " + data3['buildcomments'] + "<br>";
    htmlBody += "District Admin Comments: " + data3['districtcomments'] + "<br>";
 
 // CHANGE EMAIL ADDRESS HERE to "adminemail"  
    MailApp.sendEmail({
      to: recipient,
      subject: "ATTENTION: Field Trip Application Information" + " #" + data3['subNum'],
      htmlBody: htmlBody
    });
    
    moveApproved();
    return "Submission successful. You may close this window now.";
    
  } catch(err) {
    return "Something went wrong.";
  }
}
//***********************************************************************************************************************************************
function update (num, state, comments, docURL) {
  var data = subSheet.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
      if (data[i][0] == num) {
        if (state == 3) {
          subSheet.getRange(i+1, 25, 1, 1).setValue("APPROVED").setBackground("#00FF00");
          subSheet.getRange(i+1, 28, 1, 1).setValue(comments);
          subSheet.getRange(i+1, 29, 1, 1).setValue(docURL);
        } else if (state == 2) {
          subSheet.getRange(i+1, 25, 1, 1).setValue("Pending District Approval").setBackground("#FFFF00");
          subSheet.getRange(i+1, 27, 1, 1).setValue(comments);
        } else if (state == 1) {
          subSheet.getRange(i+1, 25, 1, 1).setValue("Pending Building Approval").setBackground("#00FFFF");
        } else if (state == -2) {
          subSheet.getRange(i+1, 25, 1, 1).setValue("Rejected by Building Admin").setBackground("red");
          subSheet.getRange(i+1, 27, 1, 1).setValue(comments);
        } else {
          subSheet.getRange(i+1, 25, 1, 1).setValue("Rejected by District Admin").setBackground("red");
          subSheet.getRange(i+1, 28, 1, 1).setValue(comments);
        }
        break;
      }
  };
}
//***********************************************************************************************************************************************
function moveApproved() {
  // moves a row from a sheet to another when a magic value is entered in a column
  // adjust the following variables to fit your needs
  // see https://productforums.google.com/d/topic/docs/ehoCZjFPBao/discussion
  
  var columnNumberToWatch = 24; // column A = 1, B = 2, etc.
  var valueToWatch = "APPROVED";
  var valueToWatch2 = "Rejected";
  var sheetNameToMoveTheRowTo = "Completed";
  var sheetNameToMoveTheRowTo2 = "Rejected";
  
  var data = subSheet.getDataRange().getValues();
  //data.shift();
  for (var i = data.length - 1; i >= 0; i--) {
    Logger.log(data[i][columnNumberToWatch]);
    if (data[i][columnNumberToWatch] == valueToWatch) {
      var targetSheet = ss.getSheetByName(sheetNameToMoveTheRowTo);
      var targetRange = targetSheet.getRange(targetSheet.getLastRow() + 1, 1);
      subSheet.getRange(i+1, 1, 1, subSheet.getLastColumn()).moveTo(targetRange);
      subSheet.deleteRow(i+1);
    }
    else if (data[i][columnNumberToWatch].substring(0,8) == valueToWatch2) {
      Logger.log(data[i][columnNumberToWatch].substring(0,8));
      var targetSheet = ss.getSheetByName(sheetNameToMoveTheRowTo2);
      var targetRange = targetSheet.getRange(targetSheet.getLastRow() + 1, 1);
      subSheet.getRange(i+1, 1, 1, subSheet.getLastColumn()).moveTo(targetRange);
      subSheet.deleteRow(i+1);
    }
  };
}
//***********************************************************************************************************************************************
function getSettings() { 
  if(CACHE_SETTINGS) {
    var settings = cache.get("_settings");
  }
  
  if(settings == undefined) {
    var sheet = ss.getSheetByName(SETTINGS_SHEET);
    var values = sheet.getDataRange().getValues();
  
    var settings = {};
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      settings[row[0]] = row[1];
    }
    
    cache.put("_settings", settings, SETTINGS_CACHE_TTL);
  }
  //Logger.log(settings);
  return settings;
}
function JSONCacheService() {
  var _cache = CacheService.getPublicCache();
  var _key_prefix = "_json#";
  
  var get = function(k) {
    var payload = _cache.get(_key_prefix+k);
    if(payload !== undefined) {
      JSON.parse(payload);
    }
    return payload
  }
  
  var put = function(k, d, t) {
    _cache.put(_key_prefix+k, JSON.stringify(d), t);
  }
  
  return {
    'get': get,
    'put': put
  }
}
//**************************************************************************************************************************************************
String.prototype.toHHMM = function () {
    var tag = "";
    var ampm = this.slice(-2);
    var timeArray = this.split(":");
    var hour = parseInt(timeArray[0],10);
    var minute = parseInt(timeArray[1],10);
    if (ampm == "PM") {
      tag = " pm";
    }
    else {
      tag = " am";
    }
    if (minute < 10) {
       minute = "0" + minute;
    }

    return "'" + hour + ':' + minute + tag;
}
//**************************************************************************************************************************************************
function testStuff() {
  Logger.log(SETTINGS.ADMIN_EMAIL);
}
function testMerge() {
  var doc = doMerge(27,"SMITH", SETTINGS.DESTINATION_FOLDER_ID, SETTINGS.TEMPLATE_ID, SPREADSHEET_ID);
}