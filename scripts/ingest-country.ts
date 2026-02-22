#!/usr/bin/env tsx
/**
 * Country-scope ingestion for Malta.
 *
 * This script ingests the full corpus discovered from legislation.mt and writes
 * seed files under data/seed-country/.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

import { fetchBufferWithRateLimit, fetchTextWithRateLimit } from './lib/fetcher.js';
import {
  parseEliMetadataForLanguage,
  parseProvisionsFromPdfText,
  extractDefinitionsFromProvisions,
  type ParsedAct,
  type ParsedProvision,
} from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INDEX_PATH = path.resolve(__dirname, '../data/corpus/malta-index.json');
const SOURCE_DIR = path.resolve(__dirname, '../data/source-country');
const SEED_DIR = path.resolve(__dirname, '../data/seed-country');
const FAIL_LOG = path.resolve(__dirname, '../data/corpus/malta-failures.log');

interface CorpusItem {
  url_path: string;
  chapter_code?: string;
  chapter_title?: string;
  source: 'top' | 'child';
  parent_id?: string;
  parent_chapter?: string;
}

interface CorpusIndex {
  items: CorpusItem[];
}

interface Args {
  offset: number;
  limit: number | null;
  resume: boolean;
  indexPath: string;
  keepSource: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let offset = 0;
  let limit: number | null = null;
  let resume = true;
  let indexPath = INDEX_PATH;
  let keepSource = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--offset' && args[i + 1]) {
      offset = Number.parseInt(args[i + 1], 10);
      i += 1;
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = Number.parseInt(args[i + 1], 10);
      i += 1;
    } else if (args[i] === '--no-resume') {
      resume = false;
    } else if (args[i] === '--index' && args[i + 1]) {
      indexPath = path.resolve(process.cwd(), args[i + 1]);
      i += 1;
    } else if (args[i] === '--keep-source') {
      keepSource = true;
    }
  }

  return { offset, limit, resume, indexPath, keepSource };
}

function ensureDirs(keepSource: boolean): void {
  if (keepSource) {
    fs.mkdirSync(SOURCE_DIR, { recursive: true });
  }
  fs.mkdirSync(SEED_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(FAIL_LOG), { recursive: true });
}

function pathToId(urlPath: string): string {
  return `mt-${urlPath.replace(/^eli\//, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()}`;
}

function extractEliPathAndLanguage(urlPath: string): { eliPath: string; lang: 'eng' | 'mlt' } {
  const parts = urlPath.replace(/^\/+/, '').split('/');
  if (parts.length < 3 || parts[0] !== 'eli') {
    throw new Error(`Unsupported url_path format: ${urlPath}`);
  }

  const maybeLang = parts[parts.length - 1].toLowerCase();
  const lang: 'eng' | 'mlt' = maybeLang === 'eng' ? 'eng' : 'mlt';
  const eliPath = parts.slice(1, parts.length - 1).join('/');

  return { eliPath, lang };
}

function pdfBufferToText(pdfBuffer: Buffer): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-law-pdf-'));
  const tempTxt = path.join(tempDir, 'document.txt');

  try {
    execFileSync('pdftotext', ['-', tempTxt], {
      input: pdfBuffer,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (!fs.existsSync(tempTxt)) return '';
    return fs.readFileSync(tempTxt, 'utf8');
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup only.
    }
  }
}

function fallbackProvision(text: string): ParsedProvision[] {
  const cleaned = text.replace(/\r/g, '').replace(/\f/g, '\n').trim();
  if (!cleaned) return [];

  return [{
    provision_ref: 's1',
    section: '1',
    title: 'Full text',
    content: cleaned,
    metadata: {
      extraction_mode: 'fallback_full_text',
    },
  }];
}

function buildAct(item: CorpusItem, docId: string, meta: ReturnType<typeof parseEliMetadataForLanguage>, text: string): ParsedAct {
  let provisions = parseProvisionsFromPdfText(text);
  if (provisions.length === 0) {
    provisions = fallbackProvision(text);
  }

  const definitions = extractDefinitionsFromProvisions(provisions);

  return {
    id: docId,
    type: 'statute',
    title: meta.title,
    title_en: meta.titleEn,
    short_name: item.chapter_code ?? item.url_path,
    status: meta.status,
    issued_date: meta.issuedDate,
    in_force_date: meta.inForceDate,
    url: meta.sourceUrl,
    description: `Official text from legislation.mt (${item.url_path}, expression ${meta.expressionPath}).`,
    provisions,
    definitions,
  };
}

function appendFailure(line: string): void {
  fs.appendFileSync(FAIL_LOG, `${new Date().toISOString()}\t${line}\n`);
}

async function ingestOne(
  item: CorpusItem,
  keepSource: boolean,
): Promise<{ status: string; provisions: number; definitions: number; }> {
  const docId = pathToId(item.url_path);
  const seedPath = path.join(SEED_DIR, `${docId}.json`);

  const { eliPath, lang } = extractEliPathAndLanguage(item.url_path);
  const pageUrl = `https://legislation.mt/eli/${eliPath}/${lang}/pdf`;

  const htmlPath = path.join(SOURCE_DIR, `${docId}.html`);
  const pdfPath = path.join(SOURCE_DIR, `${docId}.pdf`);
  const txtPath = path.join(SOURCE_DIR, `${docId}.txt`);

  const page = await fetchTextWithRateLimit(pageUrl);
  if (page.status !== 200) {
    return { status: `HTTP_${page.status}_PAGE`, provisions: 0, definitions: 0 };
  }

  if (keepSource) {
    fs.writeFileSync(htmlPath, page.body);
  }

  const meta = parseEliMetadataForLanguage(page.body, eliPath, lang);
  const pdfUrl = `https://legislation.mt/getpdf/${meta.snapshotId}`;

  const pdf = await fetchBufferWithRateLimit(pdfUrl);
  if (pdf.status !== 200) {
    return { status: `HTTP_${pdf.status}_PDF`, provisions: 0, definitions: 0 };
  }

  if (keepSource) {
    fs.writeFileSync(pdfPath, pdf.body);
  }

  const text = pdfBufferToText(pdf.body);
  if (keepSource) {
    fs.writeFileSync(txtPath, text);
  }
  const act = buildAct(item, docId, meta, text);

  if (act.provisions.length === 0) {
    return { status: 'NO_TEXT', provisions: 0, definitions: 0 };
  }

  fs.writeFileSync(seedPath, `${JSON.stringify(act, null, 2)}\n`);

  return {
    status: 'OK',
    provisions: act.provisions.length,
    definitions: act.definitions.length,
  };
}

async function main(): Promise<void> {
  const args = parseArgs();
  ensureDirs(args.keepSource);

  const indexRaw = fs.readFileSync(args.indexPath, 'utf8');
  const index = JSON.parse(indexRaw) as CorpusIndex;

  const items = index.items.slice(args.offset, args.limit ? args.offset + args.limit : undefined);

  console.log('Maltese Law MCP -- Country Scope Ingestion');
  console.log('===========================================');
  console.log(`Index: ${args.indexPath}`);
  console.log(`Total items in index: ${index.items.length}`);
  console.log(`Processing window: offset=${args.offset}, count=${items.length}`);
  console.log(`Resume mode: ${args.resume ? 'ON' : 'OFF'}`);
  console.log(`Keep source artifacts: ${args.keepSource ? 'ON' : 'OFF'}`);
  console.log('');

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let totalProvisions = 0;
  let totalDefinitions = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const docId = pathToId(item.url_path);
    const seedPath = path.join(SEED_DIR, `${docId}.json`);

    if (args.resume && fs.existsSync(seedPath)) {
      skipped += 1;
      processed += 1;
      if (processed % 25 === 0) {
        console.log(`Progress ${processed}/${items.length} (skipped=${skipped}, failed=${failed})`);
      }
      continue;
    }

    try {
      const result = await ingestOne(item, args.keepSource);
      if (result.status !== 'OK') {
        failed += 1;
        appendFailure(`${docId}\t${item.url_path}\t${result.status}`);
      } else {
        totalProvisions += result.provisions;
        totalDefinitions += result.definitions;
      }
    } catch (error) {
      failed += 1;
      const msg = error instanceof Error ? error.message : String(error);
      appendFailure(`${docId}\t${item.url_path}\tERROR\t${msg}`);
    }

    processed += 1;
    if (processed % 25 === 0) {
      console.log(`Progress ${processed}/${items.length} (skipped=${skipped}, failed=${failed})`);
    }
  }

  console.log(`\nCompleted window: ${processed} items`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Provisions (this run): ${totalProvisions}`);
  console.log(`Definitions (this run): ${totalDefinitions}`);
  console.log(`Seeds directory: ${SEED_DIR}`);
  console.log(`Failures log: ${FAIL_LOG}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
