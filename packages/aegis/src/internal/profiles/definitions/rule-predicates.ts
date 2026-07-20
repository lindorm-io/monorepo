import type { Predicate } from "@lindorm/types";
import type { DomainClaims } from "../../utils/extract-claims.js";

// RFC 3986 scheme prefix: `scheme:` where scheme starts with a letter and is
// followed by letters/digits/`+`/`-`/`.`. A StringOrURI (RFC 7519 §4.1.1) that
// is a real URI matches; a bare word or a value with spaces does not.
const URI = /^[a-z][a-z0-9+.-]*:/i;

/**
 * `iss`, when present, must be a URI-shaped string (RFC 7519 §4.1.1 — the
 * platform always emits a URL issuer). Expressed as a flat predicate so the
 * profile rule vocabulary unifies with `assert` / matchers / `Aegis.assert`.
 * The `$or` with `$exists:false` keeps the "only when present" semantics —
 * presence is the `required` floor's job.
 */
export const ISSUER_IS_URI: Predicate<DomainClaims> = {
  issuer: { $or: [{ $exists: false }, { $regex: URI }] },
};

/**
 * RFC 9068 + ADR-0014 — an access token's `aud` resolves to exactly one
 * resource (emitted as an array-of-one on the wire). "Only when present" via
 * the `$or`; the multi/empty cases fail `$length: 1`.
 */
export const AUD_SINGLE_RESOURCE: Predicate<DomainClaims> = {
  audience: { $or: [{ $exists: false }, { $length: 1 }] },
};
