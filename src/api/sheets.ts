import Constants from "expo-constants";
import { WeightEntry } from "../types";
import { fromISODateString, toSheetDateString } from "../utils/date";

const extra = Constants.expoConfig?.extra ?? {};
const SHEET_CSV_URL = extra.sheetCsvUrl as string;
const APPS_SCRIPT_URL = extra.appsScriptUrl as string;

// Google Sheets' CSV export renders date cells in locale display format
// (e.g. "9/13/2026"), not ISO — normalize to "YYYY-MM-DD" so dates sort
// and parse consistently (Hermes' Date constructor only reliably supports ISO).
function normalizeDate(raw: string): string | null {
  const cleaned = raw.replace(/^"|"$/g, "").trim();

  const iso = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const us = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const [, m, d, y] = us;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

function parseCsv(csv: string): WeightEntry[] {
  const lines = csv.trim().split("\n");
  // First line is the header row (Date, Weight) — skip it.
  return lines
    .slice(1)
    .map((line) => {
      const [rawDate, weightStr] = line.split(",").map((s) => s.trim());
      return { date: normalizeDate(rawDate ?? ""), weight: parseFloat(weightStr) };
    })
    .filter((entry): entry is WeightEntry => entry.date !== null && !Number.isNaN(entry.weight));
}

export async function fetchEntries(): Promise<WeightEntry[]> {
  const response = await fetch(SHEET_CSV_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet data: ${response.status}`);
  }
  const csv = await response.text();
  const entries = parseCsv(csv);
  entries.sort((a, b) => a.date.localeCompare(b.date));
  return entries;
}

export async function addEntry(entry: WeightEntry): Promise<void> {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "add",
      date: toSheetDateString(fromISODateString(entry.date)),
      weight: entry.weight,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to add entry: ${response.status}`);
  }
}

// Deletes by matching date + weight rather than a row number, since a row
// number can go stale if another client modifies the sheet concurrently.
export async function deleteEntry(entry: WeightEntry): Promise<void> {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "delete",
      date: toSheetDateString(fromISODateString(entry.date)),
      weight: entry.weight,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to delete entry: ${response.status}`);
  }
  const result = await response.json();
  if (result?.error) {
    throw new Error(result.error);
  }
}
