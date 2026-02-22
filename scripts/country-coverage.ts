#!/usr/bin/env tsx
/**
 * Report Malta country-scope ingestion coverage.
 *
 * Coverage is measured against data/corpus/malta-index.json:
 * - ingested: matching JSON seed exists in data/seed-country
 * - failed: matching id appears in data/corpus/malta-failures.log
 * - missing: neither ingested nor failed
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INDEX_PATH = path.resolve(__dirname, '../data/corpus/malta-index.json');
const SEED_DIR = path.resolve(__dirname, '../data/seed-country');
const FAIL_LOG = path.resolve(__dirname, '../data/corpus/malta-failures.log');

interface CorpusItem {
  url_path: string;
}

interface CorpusIndex {
  items: CorpusItem[];
  total_unique_urls: number;
}

function pathToId(urlPath: string): string {
  return `mt-${urlPath.replace(/^eli\//, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()}`;
}

function readFailureIds(): Set<string> {
  if (!fs.existsSync(FAIL_LOG)) return new Set<string>();

  const out = new Set<string>();
  const lines = fs.readFileSync(FAIL_LOG, 'utf8').split('\n').map(line => line.trim()).filter(Boolean);
  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length >= 2 && parts[1]) out.add(parts[1]);
  }
  return out;
}

function main(): void {
  if (!fs.existsSync(INDEX_PATH)) {
    throw new Error(`Missing index file: ${INDEX_PATH}`);
  }

  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8')) as CorpusIndex;
  const expectedIds = new Set(index.items.map(item => pathToId(item.url_path)));

  const ingestedIds = new Set<string>();
  if (fs.existsSync(SEED_DIR)) {
    const files = fs.readdirSync(SEED_DIR).filter(file => file.endsWith('.json'));
    for (const file of files) {
      ingestedIds.add(path.basename(file, '.json'));
    }
  }

  const failedIds = readFailureIds();

  let ingested = 0;
  let failed = 0;
  const missing: string[] = [];

  for (const id of expectedIds) {
    if (ingestedIds.has(id)) {
      ingested += 1;
    } else if (failedIds.has(id)) {
      failed += 1;
    } else {
      missing.push(id);
    }
  }

  const total = expectedIds.size;
  const covered = ingested + failed;
  const pct = total > 0 ? ((covered / total) * 100).toFixed(2) : '0.00';

  console.log('Country Coverage Report');
  console.log('=======================');
  console.log(`Index total: ${total}`);
  console.log(`Ingested: ${ingested}`);
  console.log(`Failed (logged): ${failed}`);
  console.log(`Missing: ${missing.length}`);
  console.log(`Coverage: ${covered}/${total} (${pct}%)`);

  if (missing.length > 0) {
    console.log('\nMissing sample (up to 20 ids):');
    for (const id of missing.slice(0, 20)) {
      console.log(`- ${id}`);
    }
  }
}

main();
