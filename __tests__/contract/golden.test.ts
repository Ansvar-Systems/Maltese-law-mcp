/**
 * Golden contract tests for Maltese Law MCP.
 * These assertions validate country-scope ingestion coverage, not a fixed 10-doc subset.
 *
 * skipIf: tests are skipped when data/database.db is absent (CI without DB artefact).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../../data/database.db');
const INDEX_PATH = path.resolve(__dirname, '../../data/corpus/malta-index.json');
const FAIL_LOG_PATH = path.resolve(__dirname, '../../data/corpus/malta-failures.log');

const HAS_DB = fs.existsSync(DB_PATH);

interface CorpusIndex {
  total_unique_urls: number;
  items: Array<{ url_path: string }>;
}

function pathToId(urlPath: string): string {
  return `mt-${urlPath.replace(/^eli\//, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()}`;
}

function readFailureIds(): Set<string> {
  if (!fs.existsSync(FAIL_LOG_PATH)) return new Set<string>();

  const lines = fs.readFileSync(FAIL_LOG_PATH, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
  const ids = new Set<string>();
  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length >= 2 && parts[1]) {
      ids.add(parts[1]);
    }
  }
  return ids;
}

let db: InstanceType<typeof Database>;

beforeAll(() => {
  if (!HAS_DB) return;
  db = new Database(DB_PATH, { readonly: true });
  db.pragma('journal_mode = DELETE');
});

describe.skipIf(!HAS_DB)('Country corpus coverage', () => {
  it('should include a discoverable Malta corpus index', () => {
    expect(fs.existsSync(INDEX_PATH)).toBe(true);

    const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8')) as CorpusIndex;
    expect(index.total_unique_urls).toBeGreaterThan(1000);
    expect(index.items.length).toBe(index.total_unique_urls);
  });

  it('should cover each indexed URL with a document or a logged official-source failure', () => {
    const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8')) as CorpusIndex;
    const expected = new Set(index.items.map(item => pathToId(item.url_path)));

    const rows = db.prepare('SELECT id FROM legal_documents').all() as Array<{ id: string }>;
    const present = new Set(rows.map(r => r.id));

    const failed = readFailureIds();
    const unresolved: string[] = [];

    for (const id of expected) {
      if (!present.has(id) && !failed.has(id)) {
        unresolved.push(id);
      }
    }

    expect(unresolved.slice(0, 10)).toEqual([]);
    expect(unresolved.length).toBe(0);
  });
});

describe.skipIf(!HAS_DB)('Database integrity', () => {
  it('should contain legal documents and provisions', () => {
    const docs = db.prepare('SELECT COUNT(*) as cnt FROM legal_documents').get() as { cnt: number };
    const provisions = db.prepare('SELECT COUNT(*) as cnt FROM legal_provisions').get() as { cnt: number };

    expect(docs.cnt).toBeGreaterThan(1000);
    expect(provisions.cnt).toBeGreaterThan(10000);
  });

  it('should have a populated FTS index', () => {
    const row = db.prepare("SELECT COUNT(*) as cnt FROM provisions_fts WHERE provisions_fts MATCH 'law'").get() as { cnt: number };
    expect(row.cnt).toBeGreaterThan(0);
  });

  it('should not retain obvious synthetic placeholder language', () => {
    const row = db.prepare(
      `SELECT COUNT(*) as cnt
       FROM legal_provisions
       WHERE lower(content) LIKE '%synthetic data%'
          OR lower(content) LIKE '%ai-generated%'
          OR lower(content) LIKE '%fictional law%'`
    ).get() as { cnt: number };
    expect(row.cnt).toBe(0);
  });
});

describe.skipIf(!HAS_DB)('Article retrieval', () => {
  it('should retrieve an official provision from a known chapter', () => {
    const row = db.prepare(
      "SELECT content FROM legal_provisions WHERE document_id = 'mt-cap-1-mlt' AND section = '1'"
    ).get() as { content: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.content.length).toBeGreaterThan(20);
  });
});

describe.skipIf(!HAS_DB)('Negative tests', () => {
  it('should return no results for fictional document', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM legal_provisions WHERE document_id = 'fictional-law-2099'"
    ).get() as { cnt: number };
    expect(row.cnt).toBe(0);
  });
});
