import { SpecCorpusError } from "./SpecCorpusError.js";
import { sectionKey } from "./section-key.js";
import type { ExtractInput, ExtractedSection } from "./types.js";

const ANCHOR = /<a name="rfc\.section\.(\d+(?:\.\d+)*)"/g;
const HEADING_ELEMENT = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  Aring: "\u00C5",
  aring: "\u00E5",
  gt: ">",
  ldquo: "\u201C",
  lt: "<",
  nbsp: "\u00A0",
  quot: '"',
  rdquo: "\u201D",
  rsquo: "\u2019",
};

/**
 * Typography folded to its ASCII look-alike. A non-breaking hyphen or a curly
 * quote reads identically and matches nothing, so leaving them in would make a
 * `governs` check fail on a section that does name its term.
 */
const FOLDED: Record<string, string> = {
  "\u00A0": " ",
  "\u2010": "-",
  "\u2011": "-",
  "\u2013": "-",
  "\u2014": "-",
  "\u2018": "'",
  "\u2019": "'",
  "\u201C": '"',
  "\u201D": '"',
};

const NUMERIC = /^#(x[0-9a-f]+|\d+)$/i;

const decodeEntity = (match: string, entity: string): string => {
  const numeric = NUMERIC.exec(entity);

  if (numeric) {
    const digits = numeric[1] ?? "";

    return String.fromCodePoint(
      digits.toLowerCase().startsWith("x")
        ? parseInt(digits.slice(1), 16)
        : Number(digits),
    );
  }

  const named = NAMED_ENTITIES[entity];

  if (named !== undefined) {
    return named;
  }

  // An entity nobody decoded would sit in a committed extract as markup, which
  // is the corpus carrying something the document does not say.
  throw new SpecCorpusError(`Unknown html entity ${match}`, {
    code: "entity_unknown",
    data: { entity: match },
    title: "Spec Corpus Unknown Entity",
    details:
      "The extract carries an html entity the de-tagger has no character for. Add it to the entity table and refresh.",
  });
};

const deTag = (html: string): string =>
  html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#?\w+);/g, decodeEntity)
    .replace(
      /[\u00A0\u2010\u2011\u2013\u2014\u2018\u2019\u201C\u201D]/g,
      (character) => FOLDED[character] ?? character,
    )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n");

const isDescendant = (candidate: string, section: string): boolean =>
  candidate.startsWith(`${section}.`);

/**
 * Extracts one section from an openid.net specification, whose sections are
 * addressed by `rfc.section.<n>` anchors. The named anchors these documents also
 * carry are aliases and never keys.
 */
export const extractOidcSection = ({
  docId,
  section,
  source,
}: ExtractInput): ExtractedSection => {
  const anchors = [...source.matchAll(ANCHOR)].map((match) => ({
    section: match[1] ?? "",
    at: match.index,
  }));
  const found = anchors.filter((anchor) => anchor.section === section);
  const key = sectionKey(docId, section);

  if (found.length > 1) {
    throw new SpecCorpusError(`Ambiguous anchor for ${key}`, {
      code: "section_ambiguous",
      data: { key, offsets: found.map((anchor) => anchor.at) },
      title: "Spec Corpus Ambiguous Section",
      details:
        "More than one anchor carries this section number, so which span the citation means is undecidable.",
    });
  }

  const anchor = found[0];

  if (anchor === undefined) {
    throw new SpecCorpusError(`No anchor for ${key}`, {
      code: "section_not_found",
      data: { key },
      title: "Spec Corpus Section Not Found",
      details:
        "No `rfc.section` anchor carries this section number, so the document does not contain the cited section.",
    });
  }

  const next = anchors.find(
    (candidate) =>
      candidate.at > anchor.at && isDescendant(candidate.section, section) === false,
  );
  const slice = source.slice(anchor.at, next?.at ?? source.length);
  const element = HEADING_ELEMENT.exec(slice);
  // The heading is rebuilt from its element rather than left as the markup
  // residue the anchor sits in, so an extract opens with its heading on ONE line
  // the way an RFC extract does.
  const body = deTag(
    element ? slice.slice(element.index + element[0].length) : slice,
  ).trim();
  const heading = element
    ? deTag(element[1] ?? "")
        .replace(/\s+/g, " ")
        .trim()
    : (body.split("\n")[0] ?? "");

  return {
    heading,
    body: element ? `${heading}\n\n${body}`.trim() : body,
    span: { unit: "offset", start: anchor.at, end: next?.at ?? source.length },
  };
};
