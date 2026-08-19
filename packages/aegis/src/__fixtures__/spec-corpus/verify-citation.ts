import type { DocumentCitation } from "../../internal/registry/spec-citation.js";
import { SpecCorpusError } from "./SpecCorpusError.js";
import { readSection } from "./read-section.js";
import type { CitationChecks, SectionExtract } from "./types.js";

const escape = (term: string): string => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Quoted is the RFC convention for naming a wire parameter (`"aud"`); bare with
 * word boundaries covers prose that names it without quotes. Presence is the
 * machine-checkable proxy — that the section governs the term SEMANTICALLY stays
 * a human authoring check.
 */
const isGoverned = (body: string, term: string): boolean =>
  body.includes(`"${term}"`) ||
  new RegExp(`(^|[^A-Za-z0-9_])${escape(term)}([^A-Za-z0-9_]|$)`).test(body);

/**
 * Reads the cited section and requires it to name every wire token the citation
 * claims it governs. Throws on any failure `readSection` throws on, plus
 * `term_not_governed`.
 */
export const verifyCitation = (
  citation: DocumentCitation,
  checks: CitationChecks,
  corpusUrl?: URL,
): SectionExtract => {
  const extract = readSection(citation, corpusUrl);
  const ungoverned = checks.governs.filter(
    (term) => isGoverned(extract.normalised, term) === false,
  );

  if (ungoverned.length > 0) {
    throw new SpecCorpusError(
      `Section ${extract.key} does not name ${ungoverned.join(", ")}`,
      {
        code: "term_not_governed",
        data: { key: extract.key, ungoverned, heading: extract.heading },
        title: "Spec Corpus Term Not Governed",
        details:
          "The cited section never names this wire token, so it cannot be the rule that governs it. Cite the section that does.",
      },
    );
  }

  return extract;
};
