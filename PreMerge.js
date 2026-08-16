/**
 * Initial submission receipt - thin wrapper around TripDocument.js's shared
 * builder. Kept as its own function/file (rather than inlining calls to
 * buildTripSummaryDoc directly) since "the receipt generated right at
 * submission" is a meaningful, named step in the workflow - see CodeNew.js's
 * doGet and FormHandlers.js's submitFieldTripForm for where it's called.
 * @param {number} subNumber - Submission number
 * @param {string} adultInCharge - Used only for the file name
 * @param {string} folderId - Destination Drive folder ID (INITIAL_SUB_FOLDER_ID)
 * @returns {Document|null}
 */
function doPreMerge(subNumber, adultInCharge, folderId) {
  return buildTripSummaryDoc(subNumber, adultInCharge, folderId);
}
