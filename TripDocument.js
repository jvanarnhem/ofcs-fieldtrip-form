/**
 * Trip Summary Document
 *
 * Builds the printable "Field Trip Application" Google Doc used everywhere a
 * paper/PDF summary of a trip is needed: the confirmation email attachment
 * (PreMerge.js's doPreMerge), the Print button on the Admin Dashboard, and the
 * final-approval email attachment (Merge.js's doMerge). All three call the
 * single buildTripSummaryDoc() below, so there is exactly one document design
 * to keep current - no separate Google Doc template to hand-edit when a field
 * is added to FORM_SCHEMA (that drift is what made the old version go stale).
 *
 * Deliberately condensed to fit one page for a typical trip: short/related
 * fields are grouped several-per-row as inline "Label: Value" cells
 * (addTripDocRow) rather than each getting its own full-width line - only
 * free-text fields that can run long (Purpose, Comments) get a full-width
 * line of their own (addTripDocLine).
 *
 * The Approval section only appears once building_approval_date or
 * district_approval_date actually has a value, so the same layout looks like
 * a plain receipt for a pending trip and gains the review details once it's
 * been acted on - generating it again later (e.g. re-Print after approval)
 * naturally picks that up since it re-reads the row fresh each time.
 */

var TRIP_DOC_HEADING_COLOR = '#000068';
var TRIP_DOC_FIELD_FONT_SIZE = 9.5;

/**
 * @param {number} subNumber - Submission number to render
 * @param {string} adultInCharge - Used only for the file name
 * @param {string} folderId - Destination Drive folder ID
 * @returns {Document|null} The generated Doc, or null if the submission can't be found
 */
function buildTripSummaryDoc(subNumber, adultInCharge, folderId) {
  var submission = findSubmission(subNumber);
  if (!submission) {
    Logger.log('buildTripSummaryDoc: could not find submission ' + subNumber);
    return null;
  }

  var data = submission.dataObject;

  var doc = DocumentApp.create(subNumber + ' Field Trip Application for ' + adultInCharge);
  var file = DriveApp.getFileById(doc.getId());
  var folder = DriveApp.getFolderById(folderId);
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  var body = doc.getBody();
  body.setMarginTop(20).setMarginBottom(20).setMarginLeft(40).setMarginRight(40);

  addTripDocHeader(body, data);

  addTripDocHeading(body, 'Trip Details');
  addTripDocRow(body, [['Destination', data.destination], ['Date of Trip', tripDocDateLine(data)]]);
  addTripDocRow(body, [['Depart From', data.depart_from], ['Destination Address', data.destination_address]]);

  addTripDocHeading(body, 'Contact');
  addTripDocRow(body, [['Teacher/Adult in Charge', data.adult_in_charge], ['Email', data.email], ['Phone', data.phone]]);

  addTripDocHeading(body, 'Group & Transportation');
  addTripDocRow(body, [['Students', data.num_students], ['Chaperones', data.num_adults]]);
  addTripDocRow(body, [
    ['Large Buses', data.num_large_buses || 0],
    ['Small Buses', data.num_small_buses || 0],
    ['Vans', data.num_vans || 0],
    ['Box Truck', data.need_box_truck === 'Yes' ? 'Yes' : 'No']
  ]);

  addTripDocHeading(body, 'Schedule');
  addTripDocTimeGrid(body, data);
  addTripDocRow(body, [['Extra Stop to Eat', data.extra_stop_eat || 'No'], ['Extra Stop for Restroom', data.extra_stop_restroom || 'No']]);

  if (data.school_lunch === 'Yes') {
    addTripDocLunchSection(body, data);
  }

  addTripDocHeading(body, 'Purpose & Comments');
  addTripDocLine(body, 'Purpose', data.purpose);
  if (data.comments_requests) {
    addTripDocLine(body, 'Comments/Special Requests', data.comments_requests);
  }

  if (data.building_approval_date || data.district_approval_date) {
    addTripDocApprovalSection(body, data);
  }

  addTripDocFooter(body);

  doc.saveAndClose();
  return doc;
}

function tripDocDateLine(data) {
  var datePart = formatEmailDate(data.trip_date);
  return data.day_of_week ? (data.day_of_week + ', ' + datePart) : datePart;
}

function chunkPairs(pairs, size) {
  var chunks = [];
  for (var i = 0; i < pairs.length; i += size) {
    chunks.push(pairs.slice(i, i + size));
  }
  return chunks;
}

function addTripDocHeader(body, data) {
  var titleLine = body.appendParagraph('Olmsted Falls City School District — Field Trip Application');
  titleLine.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  titleLine.editAsText().setBold(true).setFontSize(14).setForegroundColor(TRIP_DOC_HEADING_COLOR);
  titleLine.setSpacingBefore(0).setSpacingAfter(6);

  var metaTable = body.appendTable([[
    'Application #: ' + data.submission_number,
    'Building: ' + (FORM_SCHEMA.building.optionLabels[data.building] || data.building || '-'),
    'Status: ' + (data.status || '-')
  ]]);
  metaTable.setBorderWidth(0);
  for (var c = 0; c < 3; c++) {
    var cell = metaTable.getRow(0).getCell(c);
    cell.setBackgroundColor('#f0f0f0');
    cell.editAsText().setBold(true).setFontSize(9.5);
    cell.setPaddingTop(3).setPaddingBottom(3).setPaddingLeft(6).setPaddingRight(6);
  }
}

function addTripDocHeading(body, title) {
  var heading = body.appendParagraph(title.toUpperCase());
  heading.editAsText().setBold(true).setFontSize(10).setForegroundColor(TRIP_DOC_HEADING_COLOR);
  heading.setSpacingBefore(8).setSpacingAfter(2);
}

/**
 * Renders up to a handful of short fields as one compact table row, each cell
 * holding an inline "Label: Value" pair (label bold) rather than giving every
 * field its own full-width row - this is what keeps the whole document to
 * roughly a page. Falsy values are dropped so a blank field doesn't reserve a
 * column. Automatically wraps into additional rows if more than 4 pairs are
 * passed at once (see the lunch options section below).
 */
function addTripDocRow(body, pairs) {
  var visible = pairs.filter(function (p) { return p[1] !== undefined && p[1] !== null && p[1] !== ''; });
  if (!visible.length) return;

  chunkPairs(visible, 4).forEach(function (rowPairs) {
    var table = body.appendTable();
    table.setBorderWidth(0);
    var row = table.appendTableRow();

    rowPairs.forEach(function (pair) {
      var label = String(pair[0]) + ': ';
      var value = String(pair[1]);
      var cell = row.appendTableCell(label + value);
      cell.setPaddingTop(1).setPaddingBottom(1).setPaddingLeft(4).setPaddingRight(4);

      var text = cell.editAsText();
      text.setFontSize(0, (label + value).length - 1, TRIP_DOC_FIELD_FONT_SIZE);
      text.setBold(0, label.length - 1, true);
    });
  });
}

/**
 * Full-width single line for a field that can run long (Purpose, Comments) -
 * an inline table row would force awkward wrapping in a narrow column, so
 * these get the whole line instead.
 */
function addTripDocLine(body, label, value) {
  if (!value) return;
  var prefix = label + ': ';
  var paragraph = body.appendParagraph(prefix + value);
  var text = paragraph.editAsText();
  text.setFontSize(TRIP_DOC_FIELD_FONT_SIZE);
  text.setBold(0, prefix.length - 1, true);
  paragraph.setSpacingAfter(4);
}

function addTripDocTimeGrid(body, data) {
  var grid = body.appendTable([
    ['Leave School', 'Arrive Destination', 'Leave Destination', 'Arrive School'],
    [data.leave_school || '-', data.arrive_destination || '-', data.leave_destination || '-', data.arrive_school || '-']
  ]);
  for (var c = 0; c < 4; c++) {
    var headerCell = grid.getRow(0).getCell(c);
    headerCell.setBackgroundColor('#f0f0f0');
    headerCell.setPaddingTop(2).setPaddingBottom(2);
    headerCell.editAsText().setBold(true).setFontSize(8.5);
    var valueCell = grid.getRow(1).getCell(c);
    valueCell.setPaddingTop(2).setPaddingBottom(2);
    valueCell.editAsText().setFontSize(TRIP_DOC_FIELD_FONT_SIZE);
  }
}

function addTripDocLunchSection(body, data) {
  addTripDocHeading(body, 'School Prepared Lunch');

  var pairs = [['Status', data.lunch_status || LUNCH_STATUS_VALUES.AWAITING_COUNTS]];
  var namesByOption = parseLunchNamesString(data.lunch_names);
  for (var optionName in namesByOption) {
    pairs.push([optionName, namesByOption[optionName].length + ' student' + (namesByOption[optionName].length === 1 ? '' : 's')]);
  }
  addTripDocRow(body, pairs);
}

function addTripDocApprovalSection(body, data) {
  addTripDocHeading(body, 'Approval');

  if (data.building_approval_date) {
    addTripDocRow(body, [['Building Reviewed By', data.building_reviewed_by || '-'], ['Building Approval Date', formatEmailDate(data.building_approval_date)]]);
    addTripDocLine(body, 'Building Comments', data.building_comments);
  }
  if (data.district_approval_date) {
    addTripDocRow(body, [['District Reviewed By', data.district_reviewed_by || '-'], ['District Approval Date', formatEmailDate(data.district_approval_date)]]);
    addTripDocLine(body, 'District Comments', data.district_comments);
  }
}

function addTripDocFooter(body) {
  var footer = body.appendParagraph('Generated ' + formatEmailDate(new Date()) + ' – Olmsted Falls City School District Field Trip Management System');
  footer.editAsText().setFontSize(7.5).setForegroundColor('#999999');
  footer.setSpacingBefore(10);
}
