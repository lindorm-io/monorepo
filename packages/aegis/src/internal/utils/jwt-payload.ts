import { B64 } from "@lindorm/b64";
import { isObject, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { getUnixTime } from "@lindorm/date";
import { JwtError } from "../../errors/index.js";
import type {
  AegisProfile,
  AegisSensitive,
  AegisClaimsWire,
  SignJwtContent,
  SignedToken,
  TokenFormatTag,
} from "../../types/index.js";
import { joseToBuckets } from "../claims/resolve-domain-buckets.js";
import type { DomainClaims } from "./extract-claims.js";

type DecodeClaims<C extends Dict = Dict> = AegisClaimsWire & C;

/**
 * Merge the FLAT sensitive-identity fields (registry `category: "sensitive"`)
 * into the DOMAIN layer so `domainToJose` maps each to its individual wire claim
 * (`nationalIdentityNumber` -> `national_identity_number`, …). They are ordinary
 * registered claims — NOT nested under a wrapper (OIDC Core §13.3 is enforced by
 * the mint encryption-forcing + the read-side honor-only-when-encrypted gate,
 * not by a wire envelope).
 */
export const withSensitiveDomain = (
  domain: Dict,
  content: Pick<SignJwtContent, "sensitive">,
): Dict => (isObject(content.sensitive) ? { ...domain, ...content.sensitive } : domain);

/**
 * Enrich the wire kit's bare `{ token }` into the domain `SignedToken` — the
 * DOMAIN sugar the transform-free kit no longer computes. The expiry bundle is
 * derived from the wire `exp`, the `tokenId` from the wire `jti`, and `format`
 * records the JOSE wire the token is (`jwt`/`jws`; the mint sign-then-encrypt
 * path re-stamps `jwe`).
 */
export const buildSignedJwt = (
  token: string,
  claims: Dict,
  objectId: string | undefined,
  format: TokenFormatTag,
): SignedToken => {
  const expiresOn =
    typeof claims.exp === "number" && Number.isFinite(claims.exp)
      ? claims.exp
      : undefined;

  return {
    expiresAt: expiresOn !== undefined ? new Date(expiresOn * 1000) : undefined,
    expiresIn: expiresOn !== undefined ? expiresOn - getUnixTime(new Date()) : undefined,
    expiresOn,
    format,
    objectId,
    token,
    tokenId: typeof claims.jti === "string" ? claims.jti : undefined,
  };
};

export const decodeJwtPayload = <C extends Dict = Dict<never>>(
  payload: string,
): DecodeClaims<C> => JSON.parse(B64.toString(payload)) as DecodeClaims<C>;

/**
 * The domain-keyed READ buckets carried by a {@link VerifiedToken} for a JWT/CWT:
 * the registered `claims` (minus profile/sensitive), the non-domain `custom`
 * bucket, the `profile` bag, and the `sensitive` bag (surfaced only when the
 * outer token was encrypted).
 */
export type DomainBuckets<C extends Dict = Dict> = {
  claims: DomainClaims;
  custom: C;
  profile: AegisProfile | undefined;
  sensitive: AegisSensitive | undefined;
};

/**
 * Build the DOMAIN buckets for a `VerifiedToken.claims`/`custom`/`profile`/
 * `sensitive` from a WIRE (jose-keyed) claim payload. The shared read gate: only
 * `iss` is STRUCTURALLY enforced. `exp` is deliberately NOT required here — an
 * RFC 8417 / SSF `security_event` SET carries no `exp` (`lifetime: null`), yet
 * must verify; `exp` PRESENCE is POLICY (the verify floor / `expPresence`
 * matcher), not a structural read. `iat` is likewise NOT required (RFC 7523 §3
 * makes it optional on a client assertion).
 */
export const buildDomainClaims = <C extends Dict = Dict>(
  wire: Dict,
  encrypted: boolean,
): DomainBuckets<C> => {
  // `iss` must be a NON-EMPTY string. Not a URI: this shared gate also reads RFC
  // 7523 client assertions, whose `iss` is the client_id (an opaque string, not a
  // URL/URN). The platform-issuer exact match is enforced higher up
  // (enforceVerifyFloor for `issuer: "platform"` profiles).
  if (!isString(wire.iss) || wire.iss.length === 0) {
    throw new JwtError("Missing claim: iss", {
      code: "jwt_missing_claim_iss",
      title: "JWT Missing Claim ISS",
      details:
        "The payload has no non-empty string iss claim, which is required to verify a JWT.",
    });
  }

  // The ONE `jose -> domain` resolution, all the way to the four buckets — the
  // same step `Aegis.toDomain` runs. Registered claims resolve to their domain
  // names, unregistered custom claims flip snake_case -> camelCase into `custom`
  // (R18), and the profile / sensitive categories are partitioned off.
  const { claims, custom, profile, sensitive } = joseToBuckets<C>(wire);

  // OIDC Core §13.3 — the one thing this path adds, and the reason the gate is
  // NOT in the shared step: sensitive claims are SURFACED only when the outer
  // token was encrypted (jwe/cwe). On an unencrypted token they are suppressed.
  // `claims` has them stripped either way, so a cleartext token leaks nothing
  // regardless of this line.
  return {
    claims,
    custom,
    profile,
    sensitive: encrypted ? sensitive : undefined,
  };
};
