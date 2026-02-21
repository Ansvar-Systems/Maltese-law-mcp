/**
 * Parser utilities for Maltese legislation hosted on legislation.mt (ELI pages + PDF text).
 *
 * This module parses:
 * 1. Metadata from an ELI landing page (snapshot id, status, dates, titles)
 * 2. Section-level provisions from pdftotext output
 */

export interface CorpusEntry {
  id: string;
  seedFile: string;
  shortName: string;
  eliPath: string; // e.g. "cap/586" or "sl/460.43"
}

export interface ParsedProvision {
  provision_ref: string;
  chapter?: string;
  section: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

export interface ParsedAct {
  id: string;
  type: 'statute';
  title: string;
  title_en: string;
  short_name: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issued_date: string;
  in_force_date: string;
  url: string;
  description: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

export interface ELIPageMetadata {
  title: string;
  titleEn: string;
  expressionPath: string; // e.g. eli/cap/586/20230919/eng
  sourceUrl: string;
  snapshotId: string;
  issuedDate: string;
  inForceDate: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .trim();
}

function normaliseTitle(raw: string): string {
  return decodeHtmlEntities(raw)
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<i>/gi, '')
    .replace(/<\/i>/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+\(\s*/g, ' (')
    .replace(/\s+\)/g, ')')
    .trim();
}

function deriveStatusFromHtml(html: string): 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force' {
  const legalForceMatch = html.match(/"legislationLegalForce"\s*:\s*\{[\s\S]*?"@type"\s*:\s*"https:\/\/schema\.org\/(InForce|NotInForce)"/i);
  const legalForce = legalForceMatch?.[1];

  if (legalForce?.toLowerCase() === 'inforce') {
    return 'in_force';
  }

  if (/repealed|im\s*\u0127assar/i.test(html)) {
    return 'repealed';
  }

  return 'not_yet_in_force';
}

function pickDateOrFallback(date: string | undefined, fallback: string | undefined): string {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  if (fallback && /^\d{4}-\d{2}-\d{2}$/.test(fallback)) return fallback;
  return '1970-01-01';
}

export function parseEliMetadata(html: string, eliPath: string): ELIPageMetadata {
  const escapedPath = escapeRegex(eliPath);

  const expressionMatches = [
    ...html.matchAll(new RegExp(`https://legislation\\.mt/eli/${escapedPath}/(\\d{8})/eng`, 'g')),
  ];
  if (expressionMatches.length === 0) {
    throw new Error(`Could not locate expression URL for eli/${eliPath}`);
  }
  const expressionDate = expressionMatches[expressionMatches.length - 1][1];
  const expressionPath = `eli/${eliPath}/${expressionDate}/eng`;

  const titleMetaRegex = new RegExp(
    `<meta\\s+about="mlt:eli/${escapedPath}/\\d{8}/eng"\\s+property="eli:title"\\s+content="([^"]+)"`,
    'i',
  );
  const titleMetaMatch = html.match(titleMetaRegex);

  const altTitleMatch = html.match(/"alternativeHeadline"\s*:\s*"([^"]+)"/i);
  const title = normaliseTitle(titleMetaMatch?.[1] ?? altTitleMatch?.[1] ?? eliPath.toUpperCase());

  const inForceDateRegex = new RegExp(
    `<meta\\s+about="mlt:eli/${escapedPath}/\\d{8}/eng"\\s+property="eli:first_date_entry_in_force"\\s+content="(\\d{4}-\\d{2}-\\d{2})"`,
    'i',
  );
  const publicationDateRegex = new RegExp(
    `<meta\\s+about="mlt:eli/${escapedPath}/\\d{8}/eng"\\s+property="eli:date_publication"\\s+content="(\\d{4}-\\d{2}-\\d{2})"`,
    'i',
  );

  const inForceDate = html.match(inForceDateRegex)?.[1];
  const publicationDate = html.match(publicationDateRegex)?.[1] ?? html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})"/i)?.[1];
  const legislationDate = html.match(/"legislationDate"\s*:\s*"(\d{4}-\d{2}-\d{2})"/i)?.[1];

  const snapshotMatch = html.match(/getpdf\/([0-9a-f]{24})/i);
  if (!snapshotMatch) {
    throw new Error(`Could not locate PDF snapshot id for eli/${eliPath}`);
  }

  return {
    title,
    titleEn: title,
    expressionPath,
    sourceUrl: `https://legislation.mt/${expressionPath}`,
    snapshotId: snapshotMatch[1],
    issuedDate: pickDateOrFallback(legislationDate, publicationDate),
    inForceDate: pickDateOrFallback(inForceDate, publicationDate),
    status: deriveStatusFromHtml(html),
  };
}

function cleanLine(line: string): string {
  return line
    .replace(/\u00a0/g, ' ')
    .replace(/\s+$/g, '')
    .replace(/[\u200b\u200e\u200f]/g, '');
}

function isHeaderFooterNoise(line: string): boolean {
  const t = line.trim();
  if (!t) return false;

  if (/^\d+$/.test(t)) return true;
  if (/^\[\s*(CAP|S\.L\.)\s*[0-9.]+/i.test(t)) return true;
  if (/^(CAP|S\.L\.)\s*[0-9.]+\]?$/i.test(t)) return true;
  if (/^\f+$/.test(t)) return true;

  // Running header lines are usually all-caps words without punctuation.
  if (/^[A-Z][A-Z\s\-()&/.';,]{3,}$/.test(t)) {
    if (/^(PART|BOOK|TITLE)\s+[IVXLCDM0-9]+/i.test(t)) return false;
    if (/^ARRANGEMENT/i.test(t)) return false;
    if (/^CHAPTER\s+\d+/i.test(t)) return false;
    return true;
  }

  return false;
}

function isSectionStart(line: string): { section: string; inlineText: string } | null {
  const t = line.trim();
  const m = t.match(/^(\d{1,3}[A-Za-z]?)\.\s*(.*)$/);
  if (!m) return null;

  const numeric = Number((m[1].match(/\d+/) ?? ['0'])[0]);
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 250) return null;

  return { section: m[1], inlineText: m[2].trim() };
}

function deriveHeading(lines: string[], index: number): string | undefined {
  for (let i = Math.max(0, index - 4); i < index; i++) {
    const t = lines[i].trim();
    if (/^(PART|BOOK|TITLE)\s+[IVXLCDM0-9]+$/i.test(t)) {
      for (let j = i + 1; j <= Math.min(lines.length - 1, i + 3); j++) {
        const next = lines[j].trim();
        if (!next) continue;
        if (isSectionStart(next)) continue;
        if (/^(PART|BOOK|TITLE)\s+[IVXLCDM0-9]+$/i.test(next)) continue;
        return `${t.toUpperCase()} - ${next}`;
      }
      return t.toUpperCase();
    }
  }
  return undefined;
}

function deriveProvisionTitle(lines: string[], index: number, fallbackSection: string): string {
  // Prefer short standalone marginal headings (usually immediately above section numbers).
  for (let i = index - 1; i >= Math.max(0, index - 20); i--) {
    const candidate = lines[i].trim();
    if (!candidate) continue;
    if (isHeaderFooterNoise(candidate)) continue;
    if (isSectionStart(candidate)) continue;
    if (/^(PART|BOOK|TITLE)\s+[IVXLCDM0-9]+$/i.test(candidate)) continue;
    if (/^ARRANGEMENT/i.test(candidate)) continue;
    if (/^[A-Z][A-Za-z0-9 ,()'\/&-]{1,120}\.$/.test(candidate)) {
      return candidate.replace(/\.$/, '');
    }
  }

  for (let i = index - 1; i >= Math.max(0, index - 8); i--) {
    const candidate = lines[i].trim();
    if (!candidate) continue;
    if (isHeaderFooterNoise(candidate)) continue;
    if (isSectionStart(candidate)) continue;
    if (/^(PART|BOOK|TITLE)\s+[IVXLCDM0-9]+$/i.test(candidate)) continue;
    if (/^ARRANGEMENT/i.test(candidate)) continue;
    if (candidate.length <= 80) {
      return candidate.replace(/\.$/, '');
    }
  }

  return `Section ${fallbackSection}`;
}

function cleanupChunkLines(lines: string[]): string[] {
  let result: string[] = [];

  for (const raw of lines) {
    const line = cleanLine(raw);
    if (isHeaderFooterNoise(line)) continue;

    // Drop isolated amendment year lines that leak from marginal notes.
    if (/^(18|19|20)\d{2}\.$/.test(line.trim())) continue;
    if (/^Cap\.\s*\d+\.?$/i.test(line.trim())) continue;
    if (/^S\.L\.\s*[0-9.]+\)?$/i.test(line.trim())) continue;
    if (/^[\u25a0\u25cf\u00b7\u2013\u2014\u2022\u2023\u2043\u2219]+$/.test(line.trim())) continue;

    result.push(line);
  }

  // If a new PART/BOOK/TITLE heading appears inside the chunk, it belongs to the next block.
  const headingBreakIdx = result.findIndex(line => /^(PART|BOOK|TITLE)\s+[IVXLCDM0-9]+$/i.test(line.trim()));
  if (headingBreakIdx > 0) {
    result = result.slice(0, headingBreakIdx);
  }

  // Remove trailing marginal-note titles (e.g., "Interpretation.", "Scope.").
  while (result.length > 0) {
    let last = result.length - 1;
    while (last >= 0 && result[last].trim() === '') last -= 1;
    if (last < 0) break;

    const tail = result[last].trim();
    const words = tail.split(/\s+/).filter(Boolean).length;
    const prev = last > 0 ? result[last - 1].trim() : '';
    const looksLikeMarginalTitle =
      tail.length <= 70 &&
      words <= 8 &&
      /^[A-Z][A-Za-z0-9 ,()'\/&-]{1,70}\.?$/.test(tail) &&
      (prev === '' || /^(PART|BOOK|TITLE)\s+[IVXLCDM0-9]+$/i.test(prev));

    if (!looksLikeMarginalTitle) break;
    result = result.slice(0, last);
  }

  // Trim leading/trailing empties.
  while (result.length > 0 && result[0].trim() === '') result.shift();
  while (result.length > 0 && result[result.length - 1].trim() === '') result.pop();

  return result;
}

function chunkToContent(lines: string[]): string {
  const collapsed: string[] = [];
  let previousEmpty = false;

  for (const line of lines) {
    const empty = line.trim() === '';
    if (empty) {
      if (!previousEmpty) collapsed.push('');
      previousEmpty = true;
      continue;
    }

    collapsed.push(line);
    previousEmpty = false;
  }

  return collapsed.join('\n').trim();
}

export function parseProvisionsFromPdfText(text: string): ParsedProvision[] {
  const lines = text
    .replace(/\r/g, '')
    .replace(/\f/g, '\n')
    .split('\n')
    .map(cleanLine);

  const starts: Array<{ index: number; section: string; inlineText: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const parsed = isSectionStart(lines[i]);
    if (!parsed) continue;
    starts.push({ index: i, section: parsed.section, inlineText: parsed.inlineText });
  }

  const provisions: ParsedProvision[] = [];

  for (let i = 0; i < starts.length; i++) {
    const current = starts[i];
    const nextIndex = i + 1 < starts.length ? starts[i + 1].index : lines.length;

    const chunkLines = lines.slice(current.index, nextIndex);
    if (chunkLines.length === 0) continue;

    const firstLineParsed = isSectionStart(chunkLines[0]);
    if (!firstLineParsed) continue;

    const contentLines: string[] = [];
    if (firstLineParsed.inlineText.length > 0) {
      contentLines.push(firstLineParsed.inlineText);
    }
    contentLines.push(...chunkLines.slice(1));

    const cleanedContentLines = cleanupChunkLines(contentLines);
    const content = chunkToContent(cleanedContentLines);

    // Filter low-signal artifacts from arrangement blocks / marginal fragments.
    if (content.length < 20) continue;

    const section = current.section;
    const title = deriveProvisionTitle(lines, current.index, section);
    const chapter = deriveHeading(lines, current.index);

    provisions.push({
      provision_ref: `s${section.toLowerCase()}`,
      chapter,
      section,
      title,
      content,
      metadata: {
        source_line_start: current.index + 1,
        source_line_end: nextIndex,
      },
    });
  }

  // Keep first occurrence per section to avoid duplicate extraction noise.
  const unique = new Map<string, ParsedProvision>();
  for (const prov of provisions) {
    if (!unique.has(prov.section)) {
      unique.set(prov.section, prov);
    }
  }

  return Array.from(unique.values());
}

export function extractDefinitionsFromProvisions(provisions: ParsedProvision[]): ParsedDefinition[] {
  const definitions: ParsedDefinition[] = [];
  const seen = new Set<string>();

  const patterns: RegExp[] = [
    /"([^"\n]{2,120})"\s+means\s+([^.;\n]{6,800})/gi,
    /'([^'\n]{2,120})'\s+means\s+([^.;\n]{6,800})/gi,
    /\b([A-Za-z][A-Za-z\s\-]{2,80})\s+means\s+([^.;\n]{6,800})/gi,
  ];

  for (const provision of provisions) {
    for (const pattern of patterns) {
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(provision.content)) !== null) {
        const term = m[1].replace(/\s+/g, ' ').trim();
        const definition = m[2].replace(/\s+/g, ' ').trim();

        if (term.length < 2 || definition.length < 6) continue;
        const key = `${term.toLowerCase()}::${provision.provision_ref}`;
        if (seen.has(key)) continue;

        seen.add(key);
        definitions.push({
          term,
          definition,
          source_provision: provision.provision_ref,
        });
      }
    }
  }

  return definitions;
}

export function buildParsedAct(entry: CorpusEntry, meta: ELIPageMetadata, pdfText: string): ParsedAct {
  const provisions = parseProvisionsFromPdfText(pdfText);
  const definitions = extractDefinitionsFromProvisions(provisions);

  return {
    id: entry.id,
    type: 'statute',
    title: meta.title,
    title_en: meta.titleEn,
    short_name: entry.shortName,
    status: meta.status,
    issued_date: meta.issuedDate,
    in_force_date: meta.inForceDate,
    url: meta.sourceUrl,
    description: `Official consolidated text from legislation.mt (${meta.expressionPath}).`,
    provisions,
    definitions,
  };
}
