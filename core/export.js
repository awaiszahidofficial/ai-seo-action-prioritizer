/** Prefix cells that spreadsheets could treat as formulas (CSV injection). */
export function safeCell(v         )         {
  let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (header          , rows             ) => [header, ...rows].map(r => r.map(safeCell).join(',')).join('\n');
