#!/usr/bin/env tsx
/**
 * Maltese Law MCP -- Real-data ingestion pipeline.
 *
 * Source of truth: legislation.mt (official Maltese legal portal, ELI pages)
 * Extraction method: ELI page metadata + official PDF text (pdftotext)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

import { fetchBufferWithRateLimit, fetchTextWithRateLimit } from './lib/fetcher.js';
import {
  buildParsedAct,
  parseEliMetadata,
  type CorpusEntry,
  type ParsedAct,
} from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');

const CORPUS: CorpusEntry[] = [
  {
    id: 'mt-data-protection',
    seedFile: '01-data-protection.json',
    shortName: 'DPA',
    eliPath: 'cap/586',
  },
  {
    id: 'mt-nis-regulations',
    seedFile: '02-nis-regulations.json',
    shortName: 'NIS',
    eliPath: 'sl/460.35',
  },
  {
    id: 'mt-electronic-communications',
    seedFile: '03-electronic-communications.json',
    shortName: 'ECRA',
    eliPath: 'cap/399',
  },
  {
    id: 'mt-electronic-commerce',
    seedFile: '04-electronic-commerce.json',
    shortName: 'ECA',
    eliPath: 'cap/426',
  },
  {
    id: 'mt-mdia-act',
    seedFile: '05-mdia-act.json',
    shortName: 'MDIA',
    eliPath: 'cap/591',
  },
  {
    id: 'mt-virtual-financial-assets',
    seedFile: '06-virtual-financial-assets.json',
    shortName: 'VFA',
    eliPath: 'cap/590',
  },
  {
    id: 'mt-information-technology-framework',
    seedFile: '07-information-technology-framework.json',
    shortName: 'ITAS-ACT',
    eliPath: 'cap/592',
  },
  {
    id: 'mt-critical-infrastructure',
    seedFile: '08-critical-infrastructure.json',
    shortName: 'CRI-ORDER',
    eliPath: 'sl/460.43',
  },
  {
    id: 'mt-technology-services',
    seedFile: '09-technology-services.json',
    shortName: 'ITAS-CERT',
    eliPath: 'sl/591.1',
  },
  {
    id: 'mt-freedom-of-information',
    seedFile: '10-freedom-of-information.json',
    shortName: 'FOI',
    eliPath: 'cap/496',
  },
];

interface Args {
  limit: number | null;
  skipFetch: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipFetch = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = Number.parseInt(args[i + 1], 10);
      i += 1;
    } else if (args[i] === '--skip-fetch') {
      skipFetch = true;
    }
  }

  return { limit, skipFetch };
}

function ensureDirs(): void {
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });
}

function runPdfToText(pdfPath: string, txtPath: string): void {
  execFileSync('pdftotext', [pdfPath, txtPath], { stdio: 'pipe' });
}

function readJsonIfExists<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

async function ingestOne(entry: CorpusEntry, skipFetch: boolean): Promise<{
  status: string;
  provisions: number;
  definitions: number;
}> {
  const pageUrl = `https://legislation.mt/eli/${entry.eliPath}/eng/pdf`;
  const htmlPath = path.join(SOURCE_DIR, `${entry.id}.html`);
  const pdfPath = path.join(SOURCE_DIR, `${entry.id}.pdf`);
  const txtPath = path.join(SOURCE_DIR, `${entry.id}.txt`);
  const seedPath = path.join(SEED_DIR, entry.seedFile);

  if (skipFetch && fs.existsSync(seedPath)) {
    const existing = readJsonIfExists<ParsedAct>(seedPath);
    if (existing) {
      return {
        status: 'cached',
        provisions: existing.provisions?.length ?? 0,
        definitions: existing.definitions?.length ?? 0,
      };
    }
  }

  let html: string;
  if (skipFetch && fs.existsSync(htmlPath)) {
    html = fs.readFileSync(htmlPath, 'utf8');
  } else {
    process.stdout.write(`  Fetching ELI page: ${entry.id} ...`);
    const page = await fetchTextWithRateLimit(pageUrl);
    if (page.status !== 200) {
      return { status: `HTTP ${page.status} (page)`, provisions: 0, definitions: 0 };
    }
    html = page.body;
    fs.writeFileSync(htmlPath, html);
    console.log(' OK');
  }

  const meta = parseEliMetadata(html, entry.eliPath);
  const pdfUrl = `https://legislation.mt/getpdf/${meta.snapshotId}`;

  if (!(skipFetch && fs.existsSync(pdfPath))) {
    process.stdout.write(`  Fetching PDF: ${entry.id} (${meta.snapshotId}) ...`);
    const pdf = await fetchBufferWithRateLimit(pdfUrl);
    if (pdf.status !== 200) {
      return { status: `HTTP ${pdf.status} (pdf)`, provisions: 0, definitions: 0 };
    }
    fs.writeFileSync(pdfPath, pdf.body);
    console.log(` OK (${(pdf.body.length / 1024).toFixed(0)} KB)`);
  }

  runPdfToText(pdfPath, txtPath);
  const pdfText = fs.readFileSync(txtPath, 'utf8');

  const parsed = buildParsedAct(entry, meta, pdfText);
  if (parsed.provisions.length === 0) {
    return { status: 'NO_PROVISIONS', provisions: 0, definitions: 0 };
  }

  fs.writeFileSync(seedPath, `${JSON.stringify(parsed, null, 2)}\n`);

  return {
    status: 'OK',
    provisions: parsed.provisions.length,
    definitions: parsed.definitions.length,
  };
}

async function main(): Promise<void> {
  const { limit, skipFetch } = parseArgs();
  ensureDirs();

  const docs = limit ? CORPUS.slice(0, limit) : CORPUS;

  console.log('Maltese Law MCP -- Real Ingestion');
  console.log('=================================');
  console.log(`Source: legislation.mt (official ELI + PDF)`);
  console.log(`Corpus size: ${docs.length}`);
  if (limit) console.log(`Limit: ${limit}`);
  if (skipFetch) console.log('Mode: --skip-fetch');
  console.log('');

  let totalProvisions = 0;
  let totalDefinitions = 0;
  let failed = 0;

  const report: Array<{
    id: string;
    provisions: number;
    definitions: number;
    status: string;
  }> = [];

  for (const entry of docs) {
    try {
      const result = await ingestOne(entry, skipFetch);
      totalProvisions += result.provisions;
      totalDefinitions += result.definitions;
      if (result.status !== 'OK' && result.status !== 'cached') failed += 1;
      report.push({
        id: entry.id,
        provisions: result.provisions,
        definitions: result.definitions,
        status: result.status,
      });
      if (result.status === 'OK' || result.status === 'cached') {
        console.log(`    -> ${entry.id}: ${result.provisions} provisions, ${result.definitions} definitions`);
      } else {
        console.log(`    -> ${entry.id}: ${result.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed += 1;
      report.push({ id: entry.id, provisions: 0, definitions: 0, status: `ERROR: ${message.slice(0, 90)}` });
      console.log(`    -> ${entry.id}: ERROR ${message}`);
    }
  }

  console.log(`\n${'='.repeat(88)}`);
  console.log('Ingestion report');
  console.log('='.repeat(88));
  console.log(`Processed: ${docs.length}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total provisions: ${totalProvisions}`);
  console.log(`Total definitions: ${totalDefinitions}`);
  console.log('');
  console.log(`${'Document'.padEnd(34)} ${'Provisions'.padStart(10)} ${'Definitions'.padStart(12)} ${'Status'.padStart(20)}`);
  console.log(`${'-'.repeat(34)} ${'-'.repeat(10)} ${'-'.repeat(12)} ${'-'.repeat(20)}`);
  for (const row of report) {
    console.log(`${row.id.padEnd(34)} ${String(row.provisions).padStart(10)} ${String(row.definitions).padStart(12)} ${row.status.padStart(20)}`);
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
