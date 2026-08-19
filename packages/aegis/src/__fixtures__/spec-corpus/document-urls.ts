import {
  OIDC_DOC_SLUG,
  type DocumentCitation,
  type OidcCitation,
  type OidcDoc,
  type RfcCitation,
  specUrl,
} from "../../internal/registry/spec-citation.js";
import { SpecCorpusError } from "./SpecCorpusError.js";

const RFC_DOC_ID = /^rfc(\d+)$/;

const OIDC_DOC_BY_SLUG = new Map<string, OidcDoc>(
  Object.entries(OIDC_DOC_SLUG).map(([doc, slug]) => [slug, doc as OidcDoc]),
);

const unknown = (docId: string): SpecCorpusError =>
  new SpecCorpusError(`Unknown document ${docId}`, {
    code: "document_unknown",
    data: { docId },
    title: "Spec Corpus Unknown Document",
    details:
      "A document is either `rfc<number>` or an openid.net slug the citation union already names; anything else has no source to fetch and no corpus directory to read.",
  });

/**
 * The corpus works in document ids while citations carry document names, and
 * this is the ONE crossing. Deriving a citation rather than a url keeps every
 * link in the harness coming out of `specUrl`.
 */
export const documentKind = (docId: string): "oidc" | "rfc" => {
  if (RFC_DOC_ID.test(docId)) {
    return "rfc";
  }
  if (OIDC_DOC_BY_SLUG.has(docId)) {
    return "oidc";
  }

  throw unknown(docId);
};

export const toCitation = (docId: string, section: string): DocumentCitation => {
  const rfc = RFC_DOC_ID.exec(docId);

  if (rfc) {
    const citation: RfcCitation = {
      kind: "rfc",
      rfc: `RFC ${Number(rfc[1])}`,
      section,
      url: "",
    };

    return { ...citation, url: specUrl(citation) };
  }

  const doc = OIDC_DOC_BY_SLUG.get(docId);

  if (doc) {
    const citation: OidcCitation = { kind: "oidc", doc, section, url: "" };

    return { ...citation, url: specUrl(citation) };
  }

  throw unknown(docId);
};

/** Where the WHOLE document is fetched from, as opposed to a section link. */
export const sourceUrl = (docId: string): string => {
  const rfc = RFC_DOC_ID.exec(docId);

  if (rfc) {
    return `https://www.rfc-editor.org/rfc/${docId}.txt`;
  }
  if (OIDC_DOC_BY_SLUG.has(docId)) {
    return `https://openid.net/specs/${docId}.html`;
  }

  throw unknown(docId);
};
