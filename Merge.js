/**
 * Final/reprintable trip document - thin wrapper around TripDocument.js's
 * shared builder. Same layout as doPreMerge (PreMerge.js); the only difference
 * is when it's called, so a trip that's since been approved automatically
 * picks up the Approval section since the builder re-reads the row fresh.
 * @param {number} subNumber - Submission number
 * @param {string} adultInCharge - Used only for the file name
 * @param {string} folderId - Destination Drive folder ID (DESTINATION_FOLDER_ID)
 * @returns {Document|null}
 */
function doMerge(subNumber, adultInCharge, folderId) {
  return buildTripSummaryDoc(subNumber, adultInCharge, folderId);
}
