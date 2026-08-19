import { SpecCorpusError } from "./SpecCorpusError.js";
import { sectionKey } from "./section-key.js";
import { stripPagination } from "./strip-pagination.js";
import type { ExtractInput, ExtractedSection } from "./types.js";

/**
 * Column 0 is the discriminator: body headings start there while table-of-
 * contents entries are indented with dot leaders, so a TOC line can never be
 * mistaken for the section it lists.
 */
const HEADING = /^(\d+(?:\.\d+)*)\.?[ \t]+\S/;

/** Column-0 headings that carry no number and end the numbered body. */
const WORD_HEADING =
  /^(Appendix|Acknowledg|References|Normative|Informative|Author|Contributor|Index)/;

const isDescendant = (candidate: string, section: string): boolean =>
  candidate === section || candidate.startsWith(`${section}.`);

const endOfSpan = (lines: Array<string>, start: number, section: string): number => {
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const heading = HEADING.exec(line);

    if (heading && isDescendant(heading[1] ?? "", section) === false) {
      return index;
    }
    if (WORD_HEADING.test(line)) {
      return index;
    }
  }

  return lines.length;
};

/**
 * Extracts one section from the plain-text RFC format, subsections included —
 * the scope rfc-editor's own `#section-<n>` anchor implies.
 *
 * Throws `section_not_found` or `section_ambiguous` rather than picking the
 * first of several matches: a section number recurring at column 0 is something
 * a human resolves.
 */
export const extractRfcSection = ({
  docId,
  section,
  source,
}: ExtractInput): ExtractedSection => {
  const lines = stripPagination(source).split("\n");
  const starts = lines.flatMap((line, index) =>
    HEADING.exec(line)?.[1] === section ? [index] : [],
  );
  const key = sectionKey(docId, section);

  if (starts.length > 1) {
    throw new SpecCorpusError(`Ambiguous heading for ${key}`, {
      code: "section_ambiguous",
      data: { key, lines: starts.map((index) => index + 1) },
      title: "Spec Corpus Ambiguous Section",
      details:
        "The section heading matches more than once at column 0, so which span the citation means is undecidable.",
    });
  }

  const start = starts[0];

  if (start === undefined) {
    throw new SpecCorpusError(`No heading for ${key}`, {
      code: "section_not_found",
      data: { key },
      title: "Spec Corpus Section Not Found",
      details:
        "No column-0 heading carries this section number, so the document does not contain the cited section.",
    });
  }

  const end = endOfSpan(lines, start, section);

  return {
    heading: (lines[start] ?? "").trimEnd(),
    // A page seam leaves a run of blank lines where the furniture was. Collapsing
    // it is what makes the two text formats yield the SAME extract, which
    // `extract-rfc-section.test.ts` pins across the paginated and v3 fixtures.
    body: lines
      .slice(start, end)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd(),
    span: { unit: "line", start: start + 1, end },
  };
};
