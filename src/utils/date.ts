// Always build/format from local Y/M/D components, never toISOString() or
// Date.parse() on a plain date string — those go through UTC conversion or
// engine-specific parsing and can silently shift the date by a day.

// Matches the "M/D/YYYY" format Google Sheets already uses for this column
// (see normalizeDate in api/sheets.ts, which reads the same shape back).
export function toSheetDateString(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

export function toISODateString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function fromISODateString(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
