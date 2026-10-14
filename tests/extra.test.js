import test from 'node:test'; import assert from 'node:assert/strict';
import { gscFindings } from '../core/opportunities.js'; import { extraCrawl } from '../core/crawlmore.js'; import { PLAY } from '../core/playbooks.js';
const row = (query, page, clicks, impressions, position) => ({ query, page, clicks, impressions, position, ctr: null });
test('striking distance and zero-click found on a small site', () => {
  const rows = [row('a', '/x', 0, 40, 8), row('b', '/y', 5, 100, 2), row('c', '/z', 0, 30, 30)];
  const ids = gscFindings(rows, { impressions: 170 }).map(f => f.id); assert.ok(ids.includes('striking')); assert.ok(ids.includes('zero-click'));
});
test('cannibalization candidate needs two pages for one query', () => {
  assert.ok(gscFindings([row('q', '/a', 1, 50, 5), row('q', '/b', 1, 40, 7)], { impressions: 90 }).some(f => f.id === 'cannibal'));
  assert.ok(!gscFindings([row('q', '/a', 1, 50, 5)], { impressions: 50 }).some(f => f.id === 'cannibal'));
});
test('empty input is safe', () => { assert.deepEqual(gscFindings([], { impressions: 0 }), []); assert.deepEqual(extraCrawl([]), []); });
test('crawl extras only fire when fields exist', () => {
  assert.deepEqual(extraCrawl([{ url: 'https://a.com/', status: 200 }]), []);
  const ids = extraCrawl([{ url: 'https://a.com/x', status: 200, h1: '', wordCount: 50, inlinks: 0, canonical: 'https://a.com/y' }, { url: 'https://a.com/r', status: 301 }]).map(f => f.id);
  for (const i of ['h1-missing', 'low-words', 'no-inlinks', 'canonical-diff', 'redirect']) assert.ok(ids.includes(i), i);
});
test('every finding id has a playbook', () => {
  for (const i of ['http-5xx','http-4xx','title-missing','title-duplicate','meta-missing','h1-missing','redirect','noindex','canonical-diff','low-words','no-inlinks','title-length','striking','lowctr-pos','zero-click','cannibal','gsc-low-ctr']) assert.ok(PLAY[i]?.steps.length, i);
});
