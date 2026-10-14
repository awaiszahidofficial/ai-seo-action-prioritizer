// Minimal RFC4180 parser. Treats input as untrusted text; never evaluates content.
export function parseCsv(text        )             {
  const rows             = []; let row           = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i+1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i+1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}
const norm = (s        ) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
                                               
export const GSC_ALIASES          = {
  query: ['query','topqueries','searchquery'], page: ['page','toppages','landingpage','url'],
  clicks: ['clicks'], impressions: ['impressions'], ctr: ['ctr','clickthroughrate'], position: ['position','averageposition','avgposition'], date: ['date'] };
export const CRAWL_ALIASES          = {
  url: ['address','url'], status: ['statuscode','status'], indexability: ['indexability','indexabilitystatus'],
  title: ['title1','title','pagetitle'], meta: ['metadescription1','metadescription'], h1: ['h11','h1'],
  canonical: ['canonicallinkelement1','canonicalurl','canonical'], wordCount: ['wordcount'], inlinks: ['inlinks'], redirect: ['redirecturl'] };
/** Returns field -> column index; unmatched fields are omitted so the UI can offer manual mapping. */
export function detectColumns(headers          , aliases         )                         {
  const out                         = {}; const h = headers.map(norm);
  for (const [field, names] of Object.entries(aliases)) { const i = h.findIndex(x => names.includes(x)); if (i >= 0) out[field] = i; }
  return out;
}
export function toNumber(v                    )                {
  if (v == null) return null; const s = v.trim().replace(/[,\s%]/g, ''); if (s === '' || s === '-') return null;
  const n = Number(s); return Number.isFinite(n) ? n : null;
}
