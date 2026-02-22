#!/usr/bin/env tsx
/**
 * Discover full Maltese legislation URL corpus from legislation.mt.
 *
 * Outputs data/corpus/malta-index.json containing top-level and nested URLs.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.resolve(__dirname, '../data/corpus');
const OUT_PATH = path.join(OUT_DIR, 'malta-index.json');

interface SearchRow {
  ID: string;
  Chapter: string;
  ChapterTitle: string;
  URL: string;
  HasChildren: boolean;
}

interface CorpusItem {
  url_path: string; // e.g. eli/cap/586/mlt
  chapter_code?: string;
  chapter_title?: string;
  source: 'top' | 'child';
  parent_id?: string;
  parent_chapter?: string;
}

interface CorpusIndex {
  generated_at: string;
  source: string;
  total_top_rows: number;
  total_parents_with_children: number;
  total_unique_urls: number;
  breakdown: {
    cap: number;
    sl: number;
    act: number;
    ln: number;
    other: number;
  };
  items: CorpusItem[];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function postForm(url: string, form: Record<string, string>, timeoutMs = 20000): Promise<string> {
  const body = new URLSearchParams(form).toString();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`${url} returned HTTP ${res.status}`);
  }
  return res.text();
}

async function fetchSearchPage(start: number, length: number): Promise<{ recordsFiltered: number; data: SearchRow[] }> {
  const raw = await postForm('https://legislation.mt/Search/Search', {
    draw: '1',
    start: String(start),
    length: String(length),
    'search.SearchString': '',
    'search.SearchOn': 'Whole Phrase',
    'search.SearchType': 'Title',
  });

  const parsed = JSON.parse(raw) as { recordsFiltered: number; data: SearchRow[] };
  return parsed;
}

async function fetchChildren(parentId: string): Promise<string[]> {
  const raw = await postForm('https://legislation.mt/Legislations/GetChapterChild', {
    chapterPK: parentId,
  }, 25000);

  const parsed = JSON.parse(raw) as { data: string };
  const html = String(parsed.data ?? '');
  const urls: string[] = [];

  for (const match of html.matchAll(/pdflink='([^']+)'/g)) {
    urls.push(match[1].replace(/^\/+/, ''));
  }

  return urls;
}

function breakdown(urls: string[]): CorpusIndex['breakdown'] {
  let cap = 0;
  let sl = 0;
  let act = 0;
  let ln = 0;
  let other = 0;

  for (const u of urls) {
    if (u.startsWith('eli/cap/')) cap += 1;
    else if (u.startsWith('eli/sl/')) sl += 1;
    else if (u.startsWith('eli/act/')) act += 1;
    else if (u.startsWith('eli/ln/')) ln += 1;
    else other += 1;
  }

  return { cap, sl, act, ln, other };
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const pageSize = 25;
  const first = await fetchSearchPage(0, pageSize);
  const total = Number(first.recordsFiltered);
  const rows: SearchRow[] = [...first.data];

  console.log(`Top-level rows reported: ${total}`);

  for (let start = pageSize; start < total; start += pageSize) {
    try {
      const page = await fetchSearchPage(start, pageSize);
      rows.push(...page.data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Failed top-level page start=${start}: ${msg}`);
    }

    if (start % 250 === 0) {
      console.log(`Fetched top rows: ${Math.min(start + pageSize, total)}/${total}`);
    }

    await sleep(150);
  }

  const topItems: CorpusItem[] = rows
    .filter(r => r.URL)
    .map(r => ({
      url_path: String(r.URL).replace(/^\/+/, ''),
      chapter_code: r.Chapter,
      chapter_title: String(r.ChapterTitle ?? '').replace(/<[^>]+>/g, ' ').trim(),
      source: 'top',
    }));

  const parents = rows.filter(r => r.HasChildren);
  console.log(`Parents with children: ${parents.length}`);

  const childItems: CorpusItem[] = [];
  for (let i = 0; i < parents.length; i++) {
    const parent = parents[i];

    try {
      const childUrls = await fetchChildren(parent.ID);
      for (const childUrl of childUrls) {
        childItems.push({
          url_path: childUrl,
          source: 'child',
          parent_id: parent.ID,
          parent_chapter: parent.Chapter,
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Failed children for ${parent.Chapter} (${parent.ID}): ${msg}`);
    }

    if ((i + 1) % 25 === 0) {
      console.log(`Fetched children: ${i + 1}/${parents.length}`);
    }

    await sleep(200);
  }

  const byUrl = new Map<string, CorpusItem>();
  for (const item of [...topItems, ...childItems]) {
    const key = item.url_path;
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, item);
      continue;
    }

    if (existing.source === 'child' && item.source === 'top') {
      byUrl.set(key, item);
    }
  }

  const items = Array.from(byUrl.values()).sort((a, b) => a.url_path.localeCompare(b.url_path));
  const urls = items.map(i => i.url_path);

  const index: CorpusIndex = {
    generated_at: new Date().toISOString(),
    source: 'https://legislation.mt (Search/Search + Legislations/GetChapterChild)',
    total_top_rows: rows.length,
    total_parents_with_children: parents.length,
    total_unique_urls: items.length,
    breakdown: breakdown(urls),
    items,
  };

  fs.writeFileSync(OUT_PATH, `${JSON.stringify(index, null, 2)}\n`);

  console.log(`\nCorpus index written: ${OUT_PATH}`);
  console.log(`Unique URLs: ${index.total_unique_urls}`);
  console.log(
    `Breakdown: cap=${index.breakdown.cap} sl=${index.breakdown.sl} act=${index.breakdown.act} ` +
    `ln=${index.breakdown.ln} other=${index.breakdown.other}`,
  );
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
