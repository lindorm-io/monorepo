/**
 * WHICH RULE governs a registry entry, as data rather than prose.
 *
 * The union is DISCRIMINATED and {@link ParamSpec.spec} is REQUIRED with no
 * default, so an entry no specification governs must SAY so through the `policy`
 * arm — the same discipline {@link ParamSpec.whenEmpty} carries.
 */

/**
 * OpenID Foundation specifications are not RFCs, so they need their own arm. The
 * union is CLOSED and extended only when a document is actually cited, so
 * {@link OIDC_DOC_SLUG} cannot fall out of step with it.
 */
export type OidcDoc = "FAPI 1.0 Part 2" | "OIDC Core" | "OIDC Front-Channel Logout";

/** The openid.net filename each document is published under. */
export const OIDC_DOC_SLUG: Record<OidcDoc, string> = {
  "FAPI 1.0 Part 2": "openid-financial-api-part-2-1_0",
  "OIDC Core": "openid-connect-core-1_0",
  "OIDC Front-Channel Logout": "openid-connect-frontchannel-1_0",
};

export type RfcCitation = {
  kind: "rfc";
  /** Canonical spaced prose form, e.g. `"RFC 7519"`. */
  rfc: `RFC ${number}`;
  /** Digits and dots only — no `§`, no trailing dot. */
  section: string;
  url: string;
};

export type OidcCitation = {
  kind: "oidc";
  doc: OidcDoc;
  /** NUMERIC — a named anchor (`#AuthRequest`) would need an alias table to keep in step. */
  section: string;
  url: string;
};

/** lindorm's own rule — stated, never cited, because there is nothing to cite. */
export type PolicyCitation = { kind: "policy"; why: string };

export type SpecCitation = OidcCitation | PolicyCitation | RfcCitation;

/** A citation that names a published document. */
export type DocumentCitation = OidcCitation | RfcCitation;

/** `"RFC 7519"` → `"7519"`. */
const rfcNumber = (rfc: `RFC ${number}`): string => rfc.slice("RFC ".length);

/** The document's file-stem id, e.g. `rfc7519`. */
export const specDocId = (citation: DocumentCitation): string =>
  citation.kind === "rfc" ? `rfc${rfcNumber(citation.rfc)}` : OIDC_DOC_SLUG[citation.doc];

/** The ONE derivation of a citation's url. */
export const specUrl = (citation: DocumentCitation): string =>
  citation.kind === "rfc"
    ? `https://www.rfc-editor.org/rfc/rfc${rfcNumber(citation.rfc)}#section-${citation.section}`
    : `https://openid.net/specs/${OIDC_DOC_SLUG[citation.doc]}.html#rfc.section.${citation.section}`;
