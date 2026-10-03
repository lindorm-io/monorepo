import type { Condition } from "@lindorm/match";
import type { DomainClaims } from "../../../types/claims/domain/domain-claims.js";

// A URI scheme prefix (RFC 3986): a bare word or a value with spaces does
// not match.
const URI = /^[a-z][a-z0-9+.-]*:/i;

/**
 * `iss`, when present, must be a URI-shaped string (RFC 7519 §4.1.1). The `$or`
 * with `$exists:false` leaves presence to the `required` floor.
 *
 * Floor-side: a profile `match` condition, which verify runs on the floor payload.
 */
export const ISSUER_IS_URI: Condition<DomainClaims> = {
  issuer: { $or: [{ $exists: false }, { $regex: URI }] },
};

/**
 * An access token's `aud` resolves to exactly one resource, emitted as an
 * array-of-one on the wire — STRICTER than RFC 9068 §3. "Only when present" via
 * the `$or`; the multi and empty cases fail `$length: 1`.
 *
 * Floor-side: a profile `match` condition, which verify runs on the floor payload.
 */
export const AUD_SINGLE_RESOURCE: Condition<DomainClaims> = {
  audience: { $or: [{ $exists: false }, { $length: 1 }] },
};
