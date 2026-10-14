import { detectColumns, GSC_ALIASES, parseCsv, toNumber } from './csv.js';
                                                                                                                                                          
                                                                                                                                                                             
export function importGsc(text        , mapping                         )                                           {
  const parsed = parseCsv(text); const skipped                          = [];
  const empty = { rows: [], report: { accepted: 0, skipped, ctrInterpretation: 'absent'         , missingFields: ['clicks','impressions'] } };
  if (parsed.length < 2) return empty;
  const m = mapping ?? detectColumns(parsed[0], GSC_ALIASES);
  const missingFields = ['clicks','impressions'].filter(f => m[f] === undefined);
  if (missingFields.length) return { ...empty, report: { ...empty.report, missingFields } };
  const body = parsed.slice(1);
  // CTR interpretation: explicit '%' sign or any value >1 => percent; otherwise decimal. Documented in report.
  const rawCtr = m.ctr === undefined ? [] : body.map(r => r[m.ctr] ?? '');
  const isPercent = rawCtr.some(v => v.includes('%')) || rawCtr.some(v => (toNumber(v) ?? 0) > 1);
  const ctrInterpretation = m.ctr === undefined ? 'absent' : isPercent ? 'percent' : 'decimal';
  const seen = new Set        (); const rows           = [];
  body.forEach((r, i) => {
    const clicks = toNumber(r[m.clicks]); const impressions = toNumber(r[m.impressions]);
    if (clicks === null || impressions === null || clicks < 0 || impressions < 0) return void skipped.push({ line: i + 2, reason: 'invalid clicks/impressions' });
    const key = r.join('\u0001'); if (seen.has(key)) return void skipped.push({ line: i + 2, reason: 'exact duplicate row' }); seen.add(key);
    const c = m.ctr === undefined ? null : toNumber(r[m.ctr]);
    rows.push({ query: m.query === undefined ? undefined : r[m.query]?.trim(), page: m.page === undefined ? undefined : r[m.page]?.trim(),
      clicks, impressions, ctr: c === null ? null : isPercent ? c / 100 : c, position: m.position === undefined ? null : toNumber(r[m.position]), date: m.date === undefined ? undefined : r[m.date] });
  });
  return { rows, report: { accepted: rows.length, skipped, ctrInterpretation, missingFields } };
}
/** Correctly weighted aggregates: CTR = sum(clicks)/sum(impressions); position weighted by impressions. */
export function totals(rows          ) {
  const clicks = rows.reduce((a, r) => a + r.clicks, 0), impressions = rows.reduce((a, r) => a + r.impressions, 0);
  const withPos = rows.filter(r => r.position !== null); const w = withPos.reduce((a, r) => a + r.impressions, 0);
  return { clicks, impressions, ctr: impressions ? clicks / impressions : null,
    avgPosition: w ? withPos.reduce((a, r) => a + r.position  * r.impressions, 0) / w : null };
}
