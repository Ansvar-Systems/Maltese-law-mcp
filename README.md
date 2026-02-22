# Maltese Law MCP

Maltese law database for cybersecurity compliance via Model Context Protocol (MCP).

## Features

- **Full-text search** across legislation provisions (FTS5 with BM25 ranking)
- **Article-level retrieval** for specific legal provisions
- **Citation validation** to prevent hallucinated references
- **Currency checks** to verify if laws are still in force

## Quick Start

### Claude Code (Remote)
```bash
claude mcp add maltese-law --transport http https://maltese-law-mcp.vercel.app/mcp
```

### Local (npm)
```bash
npx @ansvar/maltese-law-mcp
```

## Data Sources

Official legislation from `legislation.mt` (ELI metadata + official consolidated PDF texts), ingested into section-level seed JSON files.

## License

Apache-2.0
