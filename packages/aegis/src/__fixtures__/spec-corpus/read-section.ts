import { existsSync, readFileSync } from "node:fs";
import {
  type DocumentCitation,
  specDocId,
  specUrl,
} from "../../internal/registry/spec-citation.js";
import { SpecCorpusError } from "./SpecCorpusError.js";
import { assertPlausible } from "./assert-plausible.js";
import { sectionKey } from "./section-key.js";
import type { SectionExtract } from "./types.js";

/** The committed corpus. Data only — nothing here is fetched at read time. */
export const CORPUS_URL = new URL("../rfc/", import.meta.url);

const normalise = (body: string): string => body.replace(/\s+/g, " ").trim();

/**
 * Reads one cited section from the committed corpus.
 *
 * Every failure throws: an unknown document, a section the corpus does not
 * carry, an extract below the plausibility floor, or a `url` that disagrees with
 * the one derived from the citation itself. The floor is re-enforced HERE and
 * not only at fetch, so a committed file truncated after the fact cannot pass.
 *
 * `corpusUrl` defaults to the committed corpus; it is a parameter so the read
 * path can be proven against a deliberately broken corpus.
 */
export const readSection = (
  citation: DocumentCitation,
  corpusUrl: URL = CORPUS_URL,
): SectionExtract => {
  const docId = specDocId(citation);
  const key = sectionKey(docId, citation.section);
  const derived = specUrl(citation);

  if (citation.url !== derived) {
    throw new SpecCorpusError(`Url mismatch for ${key}`, {
      code: "url_mismatch",
      data: { key, url: citation.url, derived },
      title: "Spec Corpus Url Mismatch",
      details:
        "The citation's url is not the one its document and section derive, so the link and the section number have drifted apart.",
    });
  }

  const directory = new URL(`${docId}/`, corpusUrl);

  if (existsSync(directory) === false) {
    throw new SpecCorpusError(`Unknown document ${docId}`, {
      code: "document_unknown",
      data: { docId, key },
      title: "Spec Corpus Unknown Document",
      details:
        "The corpus carries no directory for this document. Add its sections to the want-list and refresh the corpus.",
    });
  }

  const file = new URL(`${key}.txt`, corpusUrl);

  if (existsSync(file) === false) {
    throw new SpecCorpusError(`Section missing from corpus: ${key}`, {
      code: "section_missing",
      data: { docId, key, section: citation.section },
      title: "Spec Corpus Section Missing",
      details:
        "The document is in the corpus but this section is not. A citation is never verified against a section nobody fetched — add the key to the want-list and refresh.",
    });
  }

  const body = readFileSync(file, "utf8").trimEnd();

  assertPlausible(key, body);

  return {
    key,
    docId,
    section: citation.section,
    heading: (body.split("\n")[0] ?? "").trimEnd(),
    body,
    normalised: normalise(body),
  };
};
