function addToCalendar(data3, name, docURL) {
  var eventDate = data3['tripdate'];
  var eventTitle = data3['destination'];
  var eventDetails = "Application Number: " + data3['subNum'] + "\nAdult in Charge: " + data3['adultincharge'] + "\nComments: " + data3['comments'] + "\nLink to Document: " + docURL;
  
  //Get the calendar
  var cal = CalendarApp.getCalendarsByName(name)[0];//Change the calendar name
  var eventStartTime = new Date(eventDate+","+data3['leaveschool']);
  //End time is calculated by adding an hour in the event start time 
  var eventEndTime = new Date(eventDate+","+data3['arriveschool']);
  //Create the events
  Logger.log(eventTitle + " - " + eventStartTime + " - " + eventEndTime);
  cal.createEvent(eventTitle, eventStartTime,eventEndTime ,{description:eventDetails});
}
