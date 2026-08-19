/**
 * WHICH RULE governs a registry entry, as data rather than prose.
 *
 * The union is DISCRIMINATED and {@link ParamSpec.spec} is REQUIRED with no
 * default, so an entry no specification governs must SAY so through the
 * `policy` arm. An absent cell would mean nobody decided; an explicit one means
 * someone did — the same discipline {@link ParamSpec.whenEmpty} carries.
 *
 * ⚠ A prose citation could only ever be checked by a human reading it, which is
 * how 32 wrong citations accumulated in this package. These cells are checked by
 * a test: `spec-citations.test.ts` reads the committed corpus
 * (`src/__fixtures__/rfc/`) and requires the cited section to exist AND to name
 * the parameter's own wire spelling.
 */

/**
 * The `oidc` arm exists because the OpenID Foundation specifications are not
 * RFCs and are not on rfc-editor.org — the profile claims would otherwise have
 * to claim an RFC governs them or claim lindorm invented them, and both are
 * false.
 *
 * The union is CLOSED and extended only when a document is actually cited, so
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
  /**
   * NUMERIC. The named anchors these documents also carry (`#AuthRequest`) are
   * not canonical: deriving one needs an alias table to keep in step, and the
   * point of the column is that a link is checkable without a second table to
   * trust.
   */
  section: string;
  url: string;
};

/** lindorm's own rule — stated, never cited, because there is nothing to cite. */
export type PolicyCitation = { kind: "policy"; why: string };

export type SpecCitation = OidcCitation | PolicyCitation | RfcCitation;

/** A citation that names a document, i.e. everything the corpus can check. */
export type DocumentCitation = OidcCitation | RfcCitation;

/** `"RFC 7519"` → `"7519"`. */
const rfcNumber = (rfc: `RFC ${number}`): string => rfc.slice("RFC ".length);

/** The corpus directory a citation reads from. */
export const specDocId = (citation: DocumentCitation): string =>
  citation.kind === "rfc" ? `rfc${rfcNumber(citation.rfc)}` : OIDC_DOC_SLUG[citation.doc];

/**
 * The ONE derivation of a citation's url. The `url` cell is compared against
 * this rather than trusted, so a section number and its link cannot drift apart.
 */
export const specUrl = (citation: DocumentCitation): string =>
  citation.kind === "rfc"
    ? `https://www.rfc-editor.org/rfc/rfc${rfcNumber(citation.rfc)}#section-${citation.section}`
    : `https://openid.net/specs/${OIDC_DOC_SLUG[citation.doc]}.html#rfc.section.${citation.section}`;
