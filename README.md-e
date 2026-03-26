# Maltese Law MCP Server

**The legislation.mt alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fmaltese-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/maltese-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/Maltese-law-mcp?style=social)](https://github.com/Ansvar-Systems/Maltese-law-mcp)
[![CI](https://github.com/Ansvar-Systems/Maltese-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/Maltese-law-mcp/actions/workflows/ci.yml)
[![Daily Data Check](https://github.com/Ansvar-Systems/Maltese-law-mcp/actions/workflows/check-updates.yml/badge.svg)](https://github.com/Ansvar-Systems/Maltese-law-mcp/actions/workflows/check-updates.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](docs/EU_INTEGRATION_GUIDE.md)
[![Provisions](https://img.shields.io/badge/provisions-56%2C516-blue)](docs/EU_INTEGRATION_GUIDE.md)

Query **5,009 Maltese statutes** -- from Cap. 586 (Data Protection), Cap. 9 (Kodiċi Kriminali), Cap. 16 (Kodiċi Ċivili), and more -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Maltese legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Maltese legal research means navigating legislation.mt across thousands of statutes organized by Chapter number -- a unique system where laws are cited by "Cap." rather than year, making cross-referencing non-obvious without domain knowledge. Whether you're:

- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking Maltese GDPR implementation (Cap. 586) or financial services obligations
- A **legal tech developer** building tools on Maltese law
- A **researcher** tracing EU directive transposition across Malta's bilingual English/Maltese legal system

...you shouldn't need dozens of browser tabs and manual cross-referencing between Chapter numbers. Ask Claude. Get the exact provision. With context.

This MCP server makes Maltese law **searchable, cross-referenceable, and AI-readable**.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://maltese-law-mcp.vercel.app/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add maltese-law --transport http https://maltese-law-mcp.vercel.app/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "maltese-law": {
      "type": "url",
      "url": "https://maltese-law-mcp.vercel.app/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "maltese-law": {
      "type": "http",
      "url": "https://maltese-law-mcp.vercel.app/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/maltese-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "maltese-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/maltese-law-mcp"]
    }
  }
}
```

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "maltese-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/maltese-law-mcp"]
    }
  }
}
```

---

## Example Queries

Once connected, just ask naturally:

- *"What does Cap. 586 say about data processing consent?"*
- *"Search for provisions about 'data protection' in Maltese law"*
- *"What does Cap. 9 (Kodiċi Kriminali) say about computer-related offences?"*
- *"Which Malta Chapters implement the NIS2 Directive?"*
- *"X'jgħid il-Kodiċi Kriminali dwar id-delitti tal-kompjuter?"*
- *"Sib id-dispożizzjonijiet tal-Kodiċi Ċivili dwar ir-responsabbiltà"*
- *"Is Cap. 330 (Companies Act) still in force?"*
- *"Build a legal stance on financial services licensing requirements in Malta"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Statutes** | 5,009 statutes | Comprehensive Maltese legislation from legislation.mt |
| **Provisions** | 56,516 sections | Full-text searchable with FTS5 |
| **Legal Definitions** | 0 (free tier) | Table reserved, extraction not enabled in current free build |
| **Database Size** | Optimized SQLite | Portable, pre-built |
| **Daily Updates** | Automated | Freshness checks against legislation.mt |

**Verified data only** -- every citation is validated against official sources (legislation.mt). Zero LLM-generated content.

---

## See It In Action

### Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from legislation.mt (official Maltese legislation portal)
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains regulation text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by Chapter number + article
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
legislation.mt --> Parse --> SQLite --> FTS5 snippet() --> MCP response
                    ^                        ^
             Provision parser         Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search legislation.mt by Chapter number | Search by plain language: *"data protection consent"* |
| Remember that GDPR is Cap. 586, not an Act name | Just ask about data protection -- the MCP knows the Chapter |
| Navigate multi-article statutes manually | Get the exact provision with context |
| Manual cross-referencing between Chapters | `build_legal_stance` aggregates across sources |
| "Is this Chapter still in force?" -- check manually | `check_currency` tool -- answer in seconds |
| Find EU directive transposition -- dig through EUR-Lex | `get_eu_basis` -- linked EU directives instantly |
| No API, no integration | MCP protocol -- AI-native |

**Traditional:** Search legislation.mt --> Find Chapter number --> Navigate HTML --> Ctrl+F --> Cross-reference with EU directive --> Repeat

**This MCP:** *"What are Malta's data protection obligations under Cap. 586 and how do they implement GDPR Article 6?"* -- Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across 56,516 provisions with BM25 ranking. Supports English and Maltese queries |
| `get_provision` | Retrieve specific provision by Chapter number + article (e.g., "Cap. 586" + "Article 5") |
| `check_currency` | Check if a statute is in force, amended, or repealed |
| `validate_citation` | Validate citation against database -- zero-hallucination check. Supports "Cap. 586, Art. 5" format |
| `build_legal_stance` | Aggregate citations from multiple Chapters for a legal topic |
| `format_citation` | Format citations per Maltese conventions (Cap. number + article) |
| `list_sources` | List all available statutes with metadata, coverage scope, and data provenance |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### EU Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get EU directives/regulations that a Maltese Chapter transposes or implements |
| `get_maltese_implementations` | Find Maltese Chapters implementing a specific EU act |
| `search_eu_implementations` | Search EU documents with Maltese transposition counts |
| `get_provision_eu_basis` | Get EU law references for a specific provision |
| `validate_eu_compliance` | Check transposition status of Maltese statutes against EU directives |

---

## EU Law Integration

Malta is a full EU member state (since 2004) and has transposed the complete body of EU law into Maltese national legislation, organized under the Chapter numbering system.

Key transposition areas:

- **GDPR:** Malta transposed Regulation (EU) 2016/679 via Cap. 586 (Data Protection Act)
- **NIS2:** Transposition of the NIS2 Directive (EU) 2022/2555 into Maltese law
- **AML/CFT:** Malta implements the full EU Anti-Money Laundering Directive framework, critical for Malta's financial services sector
- **Financial services:** Full MiFID II, EMIR, and related directives implemented via MFSA regulatory framework
- **Gaming regulation:** Malta Gaming Authority (MGA) framework aligned with EU free movement principles
- **Company law:** Cap. 386 (Companies Act) implements EU company law directives

The EU bridge tools allow you to query these transpositions -- finding which Maltese Chapter implements a given EU directive, or which EU directive is the basis for a specific Maltese provision.

> **Note:** Malta's Chapter-based citation system is unique within the EU. The EU tools map between EU directive numbering and Maltese Chapter numbers, allowing you to navigate both systems.

---

## Data Sources & Freshness

All content is sourced from authoritative Maltese legal databases:

- **[legislation.mt](https://legislation.mt/)** -- Official Maltese legislation portal, maintained by the Attorney General's Office

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | Gvern ta' Malta / Government of Malta, Attorney General's Office |
| **Retrieval method** | Structured data from legislation.mt |
| **Languages** | English (primary), Maltese (Malti) |
| **License** | Public domain (Maltese government official publications) |
| **Coverage** | 5,009 Chapters (statutes) across all legislative domains |

### Automated Freshness Checks (Daily)

A [daily GitHub Actions workflow](.github/workflows/check-updates.yml) monitors all data sources:

| Source | Check | Method |
|--------|-------|--------|
| **Statute amendments** | legislation.mt date comparison | All Chapters checked |
| **New Chapters** | Official Gazette (Il-Gazzetta tal-Gvern ta' Malta) | Diffed against database |
| **Repealed Chapters** | Status change detection | Flagged automatically |
| **EU transposition** | EUR-Lex Malta implementation count | Flagged if divergence detected |

**Verified data only** -- every citation is validated against official sources. Zero LLM-generated content.

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Docker Security** | Container image scanning + SBOM generation | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **OSSF Scorecard** | OpenSSF best practices scoring | Weekly |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from legislation.mt (Attorney General's Office, Malta). However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Court case coverage is not included** -- do not rely solely on this for case law research
> - **Verify critical citations** against primary sources for court filings
> - **EU cross-references** reflect transposition as captured in statute text, not EUR-Lex authoritative mapping
> - **Chapter numbering** -- always verify the current Chapter number for a statute, as renumbering can occur

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [PRIVACY.md](PRIVACY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. See [PRIVACY.md](PRIVACY.md) for guidance compliant with Kamra tal-Avukati (Chamber of Advocates, Malta) professional responsibility rules.

---

## Documentation

- **[EU Integration Guide](docs/EU_INTEGRATION_GUIDE.md)** -- Detailed EU transposition and Chapter mapping documentation
- **[EU Usage Examples](docs/EU_USAGE_EXAMPLES.md)** -- Practical EU lookup examples
- **[Security Policy](SECURITY.md)** -- Vulnerability reporting and scanning details
- **[Disclaimer](DISCLAIMER.md)** -- Legal disclaimers and professional use notices
- **[Privacy](PRIVACY.md)** -- Client confidentiality and data handling

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/Maltese-law-mcp
cd Maltese-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest            # Ingest statutes from legislation.mt
npm run build:db          # Rebuild SQLite database
npm run drift:detect      # Run drift detection against known anchors
npm run check-updates     # Check for source updates
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Reliability:** 100% ingestion success rate

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### [@ansvar/maltese-law-mcp](https://github.com/Ansvar-Systems/Maltese-law-mcp) (This Project)
**Query 5,009 Maltese Chapters directly from Claude** -- Cap. 586 (Data Protection), Cap. 9 (Kodiċi Kriminali), Cap. 16 (Kodiċi Ċivili), and more. `npx @ansvar/maltese-law-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** -- ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

### [@ansvar/sanctions-mcp](https://github.com/Ansvar-Systems/Sanctions-MCP)
**Offline-capable sanctions screening** -- OFAC, EU, UN sanctions lists. `pip install ansvar-sanctions-mcp`

**100+ national law MCPs** covering Austria, Belgium, Cyprus, Denmark, Finland, France, Germany, Greece, Ireland, Italy, Luxembourg, Netherlands, Poland, Portugal, Spain, Sweden, and more EU member states.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Court case law expansion (Maltese courts, Constitutional Court)
- EU Regulations MCP integration (full EU law text)
- Maltese-language (Malti) provision text expansion
- Historical statute versions and amendment tracking

---

## Roadmap

- [x] Core statute database with FTS5 search
- [x] Full corpus ingestion (5,009 statutes, 56,516 provisions)
- [x] EU law integration tools
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [x] Daily freshness checks
- [ ] Court case law expansion (Constitutional Court, Court of Appeal)
- [ ] Historical statute versions (amendment tracking)
- [ ] Expanded Malti-language text ingestion

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{maltese_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Maltese Law MCP Server: AI-Powered Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/Maltese-law-mcp},
  note = {5,009 Maltese statutes with 56,516 provisions}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Statutes & Legislation:** Gvern ta' Malta / Government of Malta (public domain, official government publications)
- **EU Metadata:** EUR-Lex (EU public domain)

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the European market. This MCP server started as our internal reference tool for Maltese law -- turns out everyone building compliance tools for businesses operating in Malta has the same Chapter-number research frustrations.

So we're open-sourcing it. Navigating 5,009 Chapters shouldn't require memorizing which Cap. number maps to which Act.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
