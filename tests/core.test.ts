import test from 'node:test'; import assert from 'node:assert/strict';
import { parseCsv, detectColumns, GSC_ALIASES, toNumber } from '../src/core/csv.ts';
import { importGsc, totals } from '../src/core/gsc.ts';
import { score } from '../src/core/score.ts';
import { crawlFindings, gscOpportunities } from '../src/core/rules.ts';
import { safeCell, toCsv } from '../src/core/export.ts';
test('column detection tolerates case/whitespace', () => assert.deepEqual(detectColumns([' Top queries','TOP PAGES','Clicks','Impressions','CTR','Position'], GSC_ALIASES), { query:0,page:1,clicks:2,impressions:3,ctr:4,position:5 }));
test('quoted csv', () => assert.deepEqual(parseCsv('a,b\n"x,1","y""z"\n'), [['a','b'],['x,1','y"z']]));
test('numeric parsing', () => { assert.equal(toNumber('1,234'), 1234); assert.equal(toNumber('abc'), null); });
test('CTR percent vs decimal detection', () => {
  assert.equal(importGsc('Clicks,Impressions,CTR\n1,10,10%').report.ctrInterpretation, 'percent');
  assert.equal(importGsc('Clicks,Impressions,CTR\n1,10,0.1').rows[0].ctr, 0.1);
});
test('invalid + duplicate rows reported, not silently dropped', () => {
  const r = importGsc('Clicks,Impressions\n1,10\n1,10\nx,5'); assert.equal(r.report.accepted, 1); assert.equal(r.report.skipped.length, 2);
});
test('missing required columns / empty file', () => { assert.deepEqual(importGsc('Query\nfoo').report.missingFields, ['clicks','impressions']); assert.equal(importGsc('').rows.length, 0); });
test('weighted totals', () => { const t = totals([{clicks:1,impressions:10,ctr:0.1,position:1},{clicks:99,impressions:990,ctr:0.1,position:10}]); assert.equal(t.ctr, 0.1); assert.ok(t.avgPosition! > 9.9); });
test('missing title never reaches P1; widespread 5xx can', () => {
  assert.notEqual(score({severity:2,impact:3,affected:500,confidence:0.8,evidence:0.8,effort:2}).priority, 'P1');
  assert.equal(score({severity:5,impact:4,affected:50,confidence:0.9,evidence:0.9,effort:3}).priority, 'P1');
});
test('crawl rules', () => {
  const f = crawlFindings([{url:'/a',status:500},{url:'/b',status:200,title:'T',meta:'m'},{url:'/c',status:200,title:'t',meta:''}]);
  assert.ok(f.find(x => x.id==='http-5xx')); assert.ok(f.find(x => x.id==='title-duplicate')); assert.deepEqual(crawlFindings([]), []);
});
test('gsc opportunity needs min impressions', () => assert.equal(gscOpportunities([{page:'/a',clicks:1,impressions:100,position:5}]).length, 0));
test('csv injection protection', () => { assert.equal(safeCell('=SUM(A1)'), "'=SUM(A1)"); assert.equal(toCsv(['a'],[['@x']]), "a\n'@x"); });
