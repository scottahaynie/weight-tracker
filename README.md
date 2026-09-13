# Weight Tracker

A simple Expo app that charts your weight over time, backed by a public Google Sheet.

## One-time setup

### 1. Prepare the Google Sheet

Create a Google Sheet with two columns and a header row:

| Date      | Weight |
|-----------|--------|
| 1/1/2026  | 180.2  |

Share it so "Anyone with the link" can view it (Share > General access > Anyone with the link > Viewer).

### 2. Get the CSV export URL

Your sheet's ID is the long string in its URL: `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`.

Your CSV export URL is:

```
https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=csv
```

### 3. Deploy the Apps Script Web App (for writes/deletes)

1. In the sheet, go to **Extensions > Apps Script**.
2. Delete any starter code and paste in the contents of `apps-script/Code.gs` from this repo.
3. Click **Deploy > New deployment**.
4. Select type **Web app**.
5. Set "Execute as" to **Me**, and "Who has access" to **Anyone**.
6. Click **Deploy**, authorize the permissions it asks for, and copy the resulting **Web app URL**.

If you're updating `Code.gs` on a sheet that's already deployed (e.g. pulling in a newer
version of this repo), editing the script alone isn't enough — go to
**Deploy > Manage deployments > (pencil icon) > Version: New version > Deploy**
so the live Web App URL actually picks up the change.

### 4. Configure the app

Open `app.json` and replace the placeholders under `expo.extra`:

```json
"extra": {
  "sheetCsvUrl": "https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=csv",
  "appsScriptUrl": "<YOUR_WEB_APP_URL_FROM_STEP_3>"
}
```

## Running the app

```
npm install
npm start
```

Then open in Expo Go (scan the QR code) or run `npm run ios` / `npm run android`.

## Notes

- Weight is assumed to be in lbs (purely a label — the sheet just stores numbers).
- The date field defaults to today but can be changed to any past date.
- Requires an internet connection — there's no offline/local cache.
- Deleting an entry (via "All Entries") matches by date + weight, not row number, so it's
  safe under concurrent edits from other clients. If two rows share the exact same date and
  weight, only the first match is deleted.
