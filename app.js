import { parseCsv, detectColumns, CRAWL_ALIASES, toNumber } from './core/csv.js';
import { importGsc, totals } from './core/gsc.js';
import { crawlFindings, gscOpportunities } from './core/rules.js';
import { score } from './core/score.js';
import { toCsv } from './core/export.js';
const $ = id => document.getElementById(id), KEY = 'seo-prioritizer-v1', MAX_BYTES = 5e6, MAX_LINES = 50000;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const fresh = () => ({ v: 1, name: '', url: '', gsc: null, crawl: null, tasks: {}, demo: false });
let state = (() => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return s; } catch {} return fresh(); })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { alert('This browser could not save the data (it may be too large): ' + e.message); } };

function importCrawl(text) {
  const p = parseCsv(text), skipped = [], rows = [], m = p.length ? detectColumns(p[0], CRAWL_ALIASES) : {};
  if (p.length < 2 || m.url === undefined) return { rows, report: { accepted: 0, skipped, missing: ['url'] } };
  const seen = new Set(), g = (r, k) => m[k] === undefined ? undefined : r[m[k]];
  p.slice(1).forEach((r, i) => {
    const url = (g(r, 'url') || '').trim();
    if (!/^https?:\/\//i.test(url)) return skipped.push({ line: i + 2, reason: 'invalid URL' });
    if (seen.has(url)) return skipped.push({ line: i + 2, reason: 'duplicate URL' }); seen.add(url);
    rows.push({ url, status: toNumber(g(r, 'status')) ?? undefined, title: g(r, 'title'), meta: g(r, 'meta'), h1: g(r, 'h1') });
  });
  return { rows, report: { accepted: rows.length, skipped, missing: ['status', 'title', 'meta'].filter(f => m[f] === undefined) } };
}
function findings() {
  const out = [];
  if (state.crawl) out.push(...crawlFindings(state.crawl.rows));
  if (state.gsc) {
    const o = gscOpportunities(state.gsc.rows);
    if (o.length) out.push({ id: 'gsc-low-ctr', category: 'Search Console', kind: 'review', urls: o.map(x => x.page),
      finding: `${o.length} page(s) have high impressions but CTR below half the site-wide CTR`,
      evidence: `Top: ${o[0].page} - ${o[0].impressions} impressions, ${(o[0].ctr * 100).toFixed(2)}% CTR, avg position ${o[0].position.toFixed(1)}`,
      why: 'These pages may have room for better snippets or content alignment.',
      nextSteps: 'Check query intent, brand vs non-brand queries, position and SERP features before changing titles.',
      limitations: 'Low CTR can be normal (brand queries, SERP features, position). This is a review flag only, not a diagnosis. No traffic gain is implied.',
      effortLabel: 'Low', confidence: 0.5, ...score({ severity: 2, impact: 3, affected: o.length, confidence: 0.5, evidence: 0.6, effort: 2 }) });
  }
  return out.sort((a, b) => b.score - a.score);
}
const task = id => state.tasks[id] ??= { status: 'To Do', owner: '', notes: '' };
function visible() {
  const q = $('q').value.toLowerCase(), p = $('fp').value, s = $('fs').value;
  return findings().filter(f => (!p || f.priority === p) && (!s || task(f.id).status === s) &&
    (!q || (f.finding + f.category + f.urls.join(' ')).toLowerCase().includes(q)));
}
function report(r, label) {
  if (!r) return '';
  const sk = r.report.skipped;
  return `<div class="box"><b>${label}:</b> ${r.report.accepted} rows accepted, ${sk.length} skipped.` +
    (r.report.ctrInterpretation ? ` CTR read as <b>${r.report.ctrInterpretation}</b>.` : '') +
    ((r.report.missingFields || r.report.missing || []).length ? ` Missing fields: ${(r.report.missingFields || r.report.missing).join(', ')} (related checks are skipped).` : '') +
    (sk.length ? `<details><summary>Skipped rows</summary>${sk.slice(0, 50).map(x => `line ${x.line}: ${esc(x.reason)}`).join('<br>')}${sk.length > 50 ? '<br>...' : ''}</details>` : '') + '</div>';
}
function render() {
  $('pname').value = state.name; $('purl').value = state.url;
  $('demo').hidden = !state.demo;
  $('quality').innerHTML = report(state.gsc, 'Search Console file') + report(state.crawl, 'Crawl file') || '<p class="muted">No data yet. Upload files or load the demo data.</p>';
  const all = findings(), t = state.gsc ? totals(state.gsc.rows) : null, done = all.filter(f => task(f.id).status === 'Completed').length;
  const card = (k, v, tip) => `<div class="card" title="${esc(tip || '')}"><div class="k">${k}</div><div class="v">${v}</div></div>`;
  $('cards').innerHTML = [card('URLs analyzed', state.crawl ? state.crawl.rows.length : 'no crawl data'), card('Findings', all.length),
    card('P1 / P2 actions', all.filter(f => f.priority === 'P1').length + ' / ' + all.filter(f => f.priority === 'P2').length),
    card('GSC clicks', t ? t.clicks.toLocaleString() : 'no GSC data'), card('GSC impressions', t ? t.impressions.toLocaleString() : 'no GSC data'),
    card('Overall CTR', t && t.ctr !== null ? (t.ctr * 100).toFixed(2) + '%' : 'n/a', 'Total clicks divided by total impressions'),
    card('Avg position', t && t.avgPosition !== null ? t.avgPosition.toFixed(1) : 'n/a', 'Weighted by impressions'),
    card('Completed / pending', done + ' / ' + (all.length - done))].join('');
  const rows = visible();
  $('rows').innerHTML = rows.map(f => { const k = task(f.id);
    return `<tr><td><b>${f.priority}</b><br><small>score ${f.score}</small></td><td>${esc(f.category)}<br><small>${f.kind === 'error' ? 'detected error' : 'review flag'}</small></td>
    <td>${f.urls.length} URL(s)</td><td>${esc(f.finding)}</td><td>${esc(f.confidence >= .8 ? 'High' : f.confidence >= .6 ? 'Medium' : 'Low')}</td><td>${esc(f.effortLabel)}</td>
    <td><select data-id="${esc(f.id)}" data-f="status">${['To Do', 'In Progress', 'Completed', 'Ignored'].map(s => `<option${s === k.status ? ' selected' : ''}>${s}</option>`).join('')}</select></td>
    <td><input data-id="${esc(f.id)}" data-f="owner" value="${esc(k.owner)}" placeholder="owner" aria-label="Owner"></td></tr>
    <tr class="det"><td colspan="8"><details><summary>Details, evidence and notes</summary>
    <p><b>Evidence:</b> ${esc(f.evidence)}</p><p><b>Why it matters:</b> ${esc(f.why)}</p><p><b>Next steps:</b> ${esc(f.nextSteps)}</p>
    <p><b>Limitations:</b> ${esc(f.limitations)}</p><p><b>Why this priority:</b> score ${f.score} from severity, impact, URLs affected, confidence, evidence strength and effort. P1 also needs high severity and confidence.</p>
    <p><b>Affected URLs:</b><br>${f.urls.slice(0, 25).map(esc).join('<br>')}${f.urls.length > 25 ? `<br>...and ${f.urls.length - 25} more` : ''}</p>
    <textarea data-id="${esc(f.id)}" data-f="notes" placeholder="Notes" aria-label="Notes">${esc(k.notes)}</textarea></details></td></tr>`; }).join('') ||
    `<tr><td colspan="8" class="muted">${all.length ? 'No tasks match the filters.' : 'No findings yet. Upload data to generate tasks.'}</td></tr>`;
}
async function readFile(file) {
  if (!file) return null;
  if (!/\.csv$/i.test(file.name)) { alert('Please choose a .csv file.'); return null; }
  if (file.size > MAX_BYTES) { alert('File is larger than 5 MB. Export a smaller date range or fewer rows.'); return null; }
  const text = await file.text();
  if (text.split('\n').length > MAX_LINES) { alert('File has more than 50,000 rows. Please split it.'); return null; }
  return text;
}
const unDemo = () => { if (state.demo) { state.gsc = state.crawl = null; state.tasks = {}; state.demo = false; } };
$('gscfile').onchange = async e => { const t = await readFile(e.target.files[0]); if (t === null) return; unDemo(); state.gsc = importGsc(t); save(); render(); };
$('crawlfile').onchange = async e => { const t = await readFile(e.target.files[0]); if (t === null) return; unDemo(); state.crawl = importCrawl(t); save(); render(); };
$('pname').onchange = e => { state.name = e.target.value; save(); }; $('purl').onchange = e => { state.url = e.target.value; save(); };
['q', 'fp', 'fs'].forEach(i => $(i).oninput = render);
$('rows').onchange = e => { const d = e.target.dataset; if (!d.id) return; task(d.id)[d.f] = e.target.value; save(); if (d.f === 'status') render(); };
$('demobtn').onclick = () => {
  const gsc = 'Query,Page,Clicks,Impressions,CTR,Position\ndemo a,https://demo.example/a,5,2000,0.25%,6.1\ndemo b,https://demo.example/b,120,2500,4.8%,3.2\ndemo c,https://demo.example/c,60,900,6.7%,2.0\n';
  const crawl = 'Address,Status Code,Title 1,Meta Description 1,H1-1\nhttps://demo.example/a,200,Same title,,Page A\nhttps://demo.example/b,200,Same title,Desc,Page B\nhttps://demo.example/c,500,,,\nhttps://demo.example/d,404,Gone,,\n';
  state = { ...fresh(), name: 'Demo project', url: 'https://demo.example', demo: true, gsc: importGsc(gsc), crawl: importCrawl(crawl) }; save(); render();
};
$('reset').onclick = () => { if (confirm('Delete this project and all its tasks from this browser? This cannot be undone.')) { state = fresh(); save(); render(); } };
$('export').onclick = () => {
  const rows = visible().map(f => { const k = task(f.id); return [f.priority, f.category, f.urls.length, f.finding, f.evidence, f.nextSteps, f.confidence, f.effortLabel, k.status, k.owner, k.notes]; });
  const blob = new Blob([toCsv(['Priority', 'Category', 'URL count', 'Finding', 'Evidence', 'Next steps', 'Confidence', 'Effort', 'Status', 'Owner', 'Notes'], rows)], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'action-plan.csv'; a.click(); URL.revokeObjectURL(a.href);
};
render();
