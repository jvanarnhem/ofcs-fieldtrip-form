/**
 * Builds a Date from the trip's date plus a 12-hour time string (as stored by
 * formatTimeTo12Hour, e.g. "1:30 PM"). trip_date may come back from the sheet
 * as either a real Date object or a "YYYY-MM-DD" string - see the same
 * ambiguity handled in EmailService.js's formatEmailDate.
 * @param {Date|string} tripDate - The trip date
 * @param {string} timeStr - 12-hour time string, e.g. "1:30 PM"
 * @returns {Date} Combined date/time
 */
function parseTripDateTime(tripDate, timeStr) {
  var base;
  if (tripDate instanceof Date) {
    base = new Date(tripDate.getFullYear(), tripDate.getMonth(), tripDate.getDate());
  } else {
    var dateParts = String(tripDate).split('-');
    base = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));
  }

  var match = String(timeStr || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return base;
  }

  var hours = parseInt(match[1], 10);
  var minutes = parseInt(match[2], 10);
  var meridiem = match[3].toUpperCase();

  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  base.setHours(hours, minutes, 0, 0);
  return base;
}

/**
 * Adds the approved trip to the configured district calendar
 * @param {Object} data - Submission dataObject (FORM_SCHEMA keys)
 * @param {string} calendarName - Calendar to add the event to (Settings' CALENDAR_NAME)
 * @param {string} docURL - URL of the merged approval document
 */
function addToCalendar(data, calendarName, docURL) {
  if (!calendarName) {
    return;
  }

  var cal = CalendarApp.getCalendarsByName(calendarName)[0];
  if (!cal) {
    Logger.log('addToCalendar: calendar not found - ' + calendarName);
    return;
  }

  var eventStartTime = parseTripDateTime(data.trip_date, data.leave_school);
  var eventEndTime = parseTripDateTime(data.trip_date, data.arrive_school);

  var eventDetails = 'Application Number: ' + data.submission_number +
    '\nAdult in Charge: ' + data.adult_in_charge +
    (data.district_comments ? '\nComments: ' + data.district_comments : '') +
    (docURL ? '\nLink to Document: ' + docURL : '');

  Logger.log(data.destination + ' - ' + eventStartTime + ' - ' + eventEndTime);
  cal.createEvent(data.destination, eventStartTime, eventEndTime, { description: eventDetails });
}
