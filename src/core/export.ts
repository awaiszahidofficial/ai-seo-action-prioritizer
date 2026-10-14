/** Prefix cells that spreadsheets could treat as formulas (CSV injection). */
export function safeCell(v: unknown): string {
  let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (header: string[], rows: unknown[][]) => [header, ...rows].map(r => r.map(safeCell).join(',')).join('\n');
