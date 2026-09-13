// Paste this into the Apps Script editor bound to your Google Sheet
// (Extensions > Apps Script), replacing any starter code.
// Then deploy it as a Web App (see README.md for step-by-step instructions).
//
// If you're updating an existing deployment (e.g. to add delete support),
// you must create a new deployment version for the change to take effect —
// see README.md.

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const body = JSON.parse(e.postData.contents);

  if (body.action === "delete") {
    return handleDelete(sheet, body);
  }
  return handleAdd(sheet, body);
}

function handleAdd(sheet, body) {
  if (!body.date || typeof body.weight !== "number") {
    return jsonResponse({ error: "Expected { date, weight }" });
  }
  sheet.appendRow([body.date, body.weight]);
  return jsonResponse({ success: true });
}

// Deletes the first row matching both date and weight, rather than a row
// number, so concurrent edits from other clients can't make it delete the
// wrong row.
function handleDelete(sheet, body) {
  if (!body.date || typeof body.weight !== "number") {
    return jsonResponse({ error: "Expected { date, weight }" });
  }

  const values = sheet.getDataRange().getValues();
  // values[0] is the header row; sheet rows are 1-indexed, so values[i]
  // corresponds to sheet row i + 1.
  for (let i = 1; i < values.length; i++) {
    const rowDate = formatDateCell(values[i][0]);
    const rowWeight = Number(values[i][1]);
    if (rowDate === body.date && Math.abs(rowWeight - body.weight) < 0.001) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ success: true });
    }
  }

  return jsonResponse({ error: "No matching entry found" });
}

function formatDateCell(value) {
  if (value instanceof Date) {
    return (value.getMonth() + 1) + "/" + value.getDate() + "/" + value.getFullYear();
  }
  return String(value).trim();
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
