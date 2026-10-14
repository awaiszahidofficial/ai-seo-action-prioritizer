import { score, type ScoreInput } from './score.ts';
export interface CrawlRow { url: string; status?: number; title?: string; meta?: string; h1?: string }
export interface Finding { id: string; category: string; kind: 'error' | 'review'; finding: string; urls: string[]; evidence: string; why: string; nextSteps: string; limitations: string; effortLabel: string; confidence: number; score: number; priority: string }
const mk = (id: string, category: string, kind: Finding['kind'], urls: string[], text: string, evidence: string, why: string, next: string, limits: string, s: ScoreInput): Finding => {
  const r = score(s); return { id, category, kind, finding: text, urls, evidence, why, nextSteps: next, limitations: limits, effortLabel: ['','Very low','Low','Medium','High','Very high'][s.effort], confidence: s.confidence, ...r };
};
export function crawlFindings(rows: CrawlRow[]): Finding[] {
  const out: Finding[] = []; const n = rows.length; if (!n) return out;
  const f = (p: (r: CrawlRow) => boolean) => rows.filter(p).map(r => r.url);
  const e5 = f(r => (r.status ?? 0) >= 500), e4 = f(r => (r.status ?? 0) >= 400 && (r.status ?? 0) < 500);
  if (e5.length) out.push(mk('http-5xx','Technical','error',e5,`${e5.length} URL(s) returned 5xx in the crawl`,`Status codes in uploaded crawl (${e5.length}/${n} URLs)`,'Server errors can block users and crawlers.','Check server logs, re-crawl to confirm the errors are not transient.','Live status not verified; the crawl may be stale.',{severity:5,impact:4,affected:e5.length,confidence:0.85,evidence:0.9,effort:3}));
  if (e4.length) out.push(mk('http-4xx','Technical','error',e4,`${e4.length} URL(s) returned 4xx`,`Status codes in crawl (${e4.length}/${n})`,'Broken URLs waste crawl and user attention if linked or ranked.','Fix internal links or redirect where a replacement exists; some 404s are intentional.','Intentional 404/410s cannot be distinguished from this data.',{severity:3,impact:3,affected:e4.length,confidence:0.8,evidence:0.8,effort:2}));
  const ok = rows.filter(r => r.status === 200);
  const noTitle = ok.filter(r => !r.title?.trim()).map(r => r.url);
  if (noTitle.length) out.push(mk('title-missing','On-page','error',noTitle,`${noTitle.length} indexable-status 200 page(s) have no title`,`Empty title field in crawl`,'Titles help describe pages in results; Google may rewrite or generate them.','Add unique, descriptive titles.','Title may be injected by JavaScript and absent from a non-rendered crawl.',{severity:2,impact:3,affected:noTitle.length,confidence:0.8,evidence:0.8,effort:2}));
  const byTitle = new Map<string,string[]>(); ok.forEach(r => { const t = r.title?.trim().toLowerCase(); if (t) byTitle.set(t, [...(byTitle.get(t) ?? []), r.url]); });
  const dup = [...byTitle.values()].filter(u => u.length > 1).flat();
  if (dup.length) out.push(mk('title-duplicate','On-page','review',dup,`${dup.length} pages share a title with another page`,`Exact-match titles (case-insensitive)`,'May indicate duplicate or poorly differentiated pages (pagination and variants are often legitimate).','Review groups and differentiate where pages serve different intents.','Duplicates may be intentional.',{severity:2,impact:2,affected:dup.length,confidence:0.6,evidence:0.7,effort:3}));
  const noMeta = ok.filter(r => !r.meta?.trim()).map(r => r.url);
  if (noMeta.length) out.push(mk('meta-missing','On-page','review',noMeta,`${noMeta.length} page(s) have no meta description`,'Empty meta description field','Search engines may generate snippets; a written description is optional but can help control it.','Prioritise pages with high impressions.','Not a ranking factor.',{severity:1,impact:1,affected:noMeta.length,confidence:0.8,evidence:0.8,effort:2}));
  return out.sort((a, b) => b.score - a.score);
}
export function gscOpportunities(rows: { page?: string; clicks: number; impressions: number; position: number | null }[], minImpr = 500) {
  const by = new Map<string,{ clicks: number; impressions: number; pw: number }>();
  rows.forEach(r => { if (!r.page) return; const a = by.get(r.page) ?? { clicks: 0, impressions: 0, pw: 0 }; a.clicks += r.clicks; a.impressions += r.impressions; a.pw += (r.position ?? 0) * r.impressions; by.set(r.page, a); });
  const all = [...by.entries()].map(([page, a]) => ({ page, ...a, ctr: a.clicks / a.impressions, position: a.pw / a.impressions }));
  const site = all.reduce((a, r) => a + r.clicks, 0) / (all.reduce((a, r) => a + r.impressions, 0) || 1);
  // Review candidates only: high impressions, CTR under half the site-wide CTR. Intent/brand/SERP features not assessed.
  return all.filter(r => r.impressions >= minImpr && r.ctr < site / 2).sort((a, b) => b.impressions - a.impressions);
}
