import { score } from './score.js';
const L = ['', 'Very low', 'Low', 'Medium', 'High', 'Very high'];
const agg = (rows, key) => { const m = new Map(); for (const r of rows) { const k = r[key]; if (!k) continue; const a = m.get(k) ?? { key: k, clicks: 0, impressions: 0, pw: 0 }; a.clicks += r.clicks; a.impressions += r.impressions; a.pw += (r.position ?? 0) * r.impressions; m.set(k, a); }
  return [...m.values()].map(a => ({ ...a, ctr: a.impressions ? a.clicks / a.impressions : 0, position: a.impressions ? a.pw / a.impressions : null })); };
const line = x => `${x.key} - position ${x.position === null ? 'n/a' : x.position.toFixed(1)}, ${x.impressions} impressions, ${x.clicks} clicks`;
const mk = (id, items, finding, why, limits, s) => ({ id, category: 'Search Console', kind: 'review', urls: items.map(line), finding, evidence: line(items[0]) + (items.length > 1 ? ` (+${items.length - 1} more)` : ''), why, nextSteps: 'See the how-to-fix steps below.', limitations: limits, effortLabel: L[s.effort], confidence: s.confidence, ...score(s) });
/** Thresholds scale with the site: minimum impressions = 1% of total impressions (at least 10). */
export function gscFindings(rows, total) {
  const out = [], min = Math.max(10, Math.round((total.impressions || 0) * 0.01)), q = agg(rows.filter(r => r.query), 'query'), p = agg(rows.filter(r => r.page), 'page');
  const sc = q.filter(x => x.position !== null && x.position >= 4 && x.position <= 20 && x.impressions >= min).sort((a, b) => b.impressions - a.impressions);
  if (sc.length) out.push(mk('striking', sc, `${sc.length} queries rank at positions 4-20 with at least ${min} impressions`, 'Queries just outside the top results are often the quickest to improve.', 'Position is an average and can vary by device and location. Gains are not guaranteed.', { severity: 2, impact: 4, affected: sc.length, confidence: 0.6, evidence: 0.7, effort: 3 }));
  const top = q.filter(x => x.position !== null && x.position <= 10 && x.impressions >= min), base = top.reduce((a, x) => a + x.clicks, 0) / (top.reduce((a, x) => a + x.impressions, 0) || 1);
  const lc = top.filter(x => x.ctr < base / 2).sort((a, b) => b.impressions - a.impressions);
  if (lc.length) out.push(mk('lowctr-pos', lc, `${lc.length} top-10 queries get less than half the CTR of your other top-10 queries`, 'The snippet or search intent may be a weak match for these queries.', 'Brand queries, ads and SERP features can explain low CTR. Review before editing.', { severity: 2, impact: 3, affected: lc.length, confidence: 0.5, evidence: 0.6, effort: 2 }));
  const zc = q.filter(x => x.clicks === 0 && x.impressions >= min).sort((a, b) => b.impressions - a.impressions);
  if (zc.length) out.push(mk('zero-click', zc, `${zc.length} queries have at least ${min} impressions but zero clicks`, 'People see your result but do not choose it.', 'Position may be too low to get clicks, or the query may be answered on the results page.', { severity: 2, impact: 3, affected: zc.length, confidence: 0.5, evidence: 0.6, effort: 2 }));
  const site = p.reduce((a, x) => a + x.clicks, 0) / (p.reduce((a, x) => a + x.impressions, 0) || 1);
  const pg = p.filter(x => x.impressions >= min && x.ctr < site / 2).sort((a, b) => b.impressions - a.impressions);
  if (pg.length) out.push(mk('gsc-low-ctr', pg, `${pg.length} pages have at least ${min} impressions but CTR below half the site average`, 'These pages may have room for better snippets or content alignment.', 'Review flag only; low CTR can be normal.', { severity: 2, impact: 3, affected: pg.length, confidence: 0.5, evidence: 0.6, effort: 2 }));
  const by = new Map(); rows.filter(r => r.query && r.page).forEach(r => { const m = by.get(r.query) ?? new Map(); m.set(r.page, (m.get(r.page) ?? 0) + r.impressions); by.set(r.query, m); });
  const cn = [...by].map(([k, m]) => ({ k, pages: [...m].filter(([, i]) => i >= Math.max(5, min / 2)) })).filter(x => x.pages.length > 1);
  if (cn.length) { const items = cn.map(x => ({ key: x.k + ' -> ' + x.pages.map(([u]) => u).join(' | '), impressions: x.pages.reduce((a, [, i]) => a + i, 0), clicks: 0, position: null })); out.push(mk('cannibal', items, `${cn.length} queries show more than one of your pages in search`, 'Several pages may compete for the same query.', 'Candidates only. Two pages showing for one query is not proof of a problem.', { severity: 3, impact: 3, affected: cn.length, confidence: 0.4, evidence: 0.5, effort: 4 })); }
  return out;
}
