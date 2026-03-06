/**
 * Response metadata utilities for Maltese Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_source: string;
  jurisdiction: string;
  disclaimer: string;
  freshness?: string;
  note?: string;
  query_strategy?: string;
}

export interface ToolResponse<T> {
  results: T;
  _metadata: ResponseMetadata;
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

  return {
    data_source: 'Legislation Malta (legislation.mt) — Office of the State Advocate, Legislation Unit',
    jurisdiction: 'MT',
    disclaimer:
      'This data is sourced from official Maltese legal texts published on legislation.mt. ' +
      'The authoritative versions are maintained by the Legislation Unit (Office of the State Advocate). ' +
      'Always verify citations against the official portal (legislation.mt).',
    freshness,
  };
}
