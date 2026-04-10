/**
 * Response metadata utilities for Maltese Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_source: string;
  jurisdiction: string;
  disclaimer: string;
  data_age?: string;
  copyright?: string;
  freshness?: string;
  note?: string;
  query_strategy?: string;
}

export interface ToolResponse<T> {
  results: T;
  _meta: ResponseMetadata;
  _citation?: import('./citation.js').CitationMetadata;
  _error_type?: string;
}

export function generateResponseMetadata(
  db: InstanceType<typeof Database>,
): ResponseMetadata {
  let freshness: string | undefined;
  try {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'built_at'"
    ).get() as { value: string } | undefined;
    if (row) freshness = row.value;
  } catch {
    // Ignore
  }

  let data_age: string | undefined;
  if (freshness) {
    const match = freshness.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) data_age = match[1];
  }

  return {
    data_source: 'Legislation Malta (legislation.mt) — Office of the State Advocate, Legislation Unit',
    jurisdiction: 'MT',
    disclaimer:
      'This data is sourced from official Maltese legal texts published on legislation.mt. ' +
      'The authoritative versions are maintained by the Legislation Unit (Office of the State Advocate). ' +
      'Always verify citations against the official portal (legislation.mt).',
    data_age,
    copyright: '© Office of the State Advocate, Legislation Unit (Malta). Public legal texts.',
    freshness,
  };
}
