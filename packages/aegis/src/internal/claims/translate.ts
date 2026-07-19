import { camelCase, snakeCase, snakeKeys } from "@lindorm/case";
import { getUnixTime } from "@lindorm/date";
import { isArray, isFinite, isObject, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import { AegisError } from "../../errors/index.js";
import type { ActClaim, ActClaimWire, ConfirmationClaim } from "../../types/index.js";
import { type ClaimSpec, CLAIM_REGISTRY, specByDomain, specsWith } from "./registry.js";

/**
 * The ONE claim translator (DESIGN §3). It consolidates the mappers that existed
 * before — `map-content-to-claims.ts` (domain -> jose, write), `extract-claims.ts`
 * `extractDomainClaims` (jose/camel -> domain, read), and the `domain <-> jose`
 * remap loops around `CWT_CLAIMS_KIT` in `cwt-claims.ts` — into a single
 * registry-driven, single-PASS pair per direction.
 *
 * Four public functions over TWO parameterized cores (write / read). The ONLY
 * thing that varies between the JOSE and COSE variants is the wire NAME emitted
 * or looked up — `spec.jose` for JOSE, `spec.coseName ?? spec.jose` for COSE
 * (the RFC 8392 divergence set, today just `jti` <-> `cti`). The VALUE transforms
 * are identical at the translator level (only the downstream CWT codec turns the
 * jose-shaped values into COSE labels / CBOR bytes). So `domainToCose` is a
 * single registry pass emitting COSE names — never `domainToJose` + a separate
 * rename — which is what subsumes the old `cose-names.ts` name bridge.
 *
 * It is the ONLY domain-aware claim code: both the JOSE and the COSE format
 * paths meet here. Value transforms come from the registry's `ClaimValueKind`; a
 * small co-located BESPOKE builder table (below) holds the per-claim shapes
 * (`cnf`, `act`/`may_act`, `sub_id`, `events`, `authorization_details`, the OIDC
 * hashes). All case/name conversion is Aegis-side (R18): a registered claim
 * takes the explicit registry path (name + value transform); anything NOT in the
 * registry is a custom claim whose KEY case flips mechanically (snake on write,
 * camel on read) with its value untouched.
 *
 * Hash DERIVATION is NOT here (it needs the signing algorithm and stays in
 * `assemble-common-claims.ts`); the translator only maps the already-derived
 * `accessTokenHash` -> `at_hash`, so it is fully mechanical and algorithm-free.
 */

// The wire-name selector — the ONE parameter that separates the JOSE and COSE
// variants of both cores. COSE uses the registry's `coseName` where it diverges
// (`jti` -> `cti`), else the JOSE name.
type NameSelector = (spec: ClaimSpec) => string;
const joseName: NameSelector = (spec) => spec.jose;
const coseName: NameSelector = (spec) => spec.coseName ?? spec.jose;

// --- Bespoke builders (write side), lifted from map-content-to-claims.ts -----

// RFC 8693 act / may_act: recursively map the camelCase domain shape to the wire.
const actClaimToWire = (claim: ActClaim): ActClaimWire =>
  omitUndefined({
    sub: claim.subject,
    iss: claim.issuer,
    aud: claim.audience,
    client_id: claim.clientId,
    act: isObject(claim.act) ? actClaimToWire(claim.act) : undefined,
  });

// RFC 7800 cnf: map the camelCase confirmation to the wire member names. An
// all-empty confirmation collapses to `undefined` (dropped), matching the mint
// mapper's `cnf && Object.keys(cnf).length > 0 ? cnf : undefined`.
const confirmationToWire = (claim: ConfirmationClaim): Dict | undefined => {
  const cnf = omitUndefined({
    jkt: claim.thumbprint,
    "x5t#S256": claim.mtlsCertThumbprint,
    jwk: claim.key,
    kid: claim.keyId,
    jku: claim.jwkSetUri,
  });

  return Object.keys(cnf).length > 0 ? cnf : undefined;
};

// --- Value decoders (read side), lifted from extract-claims.ts ----------------

const toDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) return value;
  if (isFinite(value)) return new Date(value * 1000);
  return undefined;
};

const toStringArray = (value: unknown): Array<string> | undefined => {
  if (isArray(value)) return value as Array<string>;
  if (isString(value)) return value.split(" ").filter(Boolean);
  return undefined;
};

const toAudience = (value: unknown): Array<string> | undefined => {
  if (isArray(value)) return value as Array<string>;
  if (isString(value)) return [value];
  return undefined;
};

// Recursively normalise an act-claim, accepting camelCase and snake at every level.
const toActClaim = (value: unknown): ActClaim | undefined => {
  if (!isObject(value)) return undefined;
  const v = value;
  const result: ActClaim = omitUndefined({
    subject: isString(v.subject) ? v.subject : isString(v.sub) ? v.sub : undefined,
    issuer: isString(v.issuer) ? v.issuer : isString(v.iss) ? v.iss : undefined,
    audience: toAudience(v.audience ?? v.aud),
    clientId: isString(v.clientId)
      ? v.clientId
      : isString(v.client_id)
        ? v.client_id
        : undefined,
    act: toActClaim(v.act),
  });
  return Object.keys(result).length > 0 ? result : undefined;
};

// RFC 7800 confirmation — inner keys are wire-form (`jkt`, `jwk`, `kid`,
// `x5t#S256`, `jku`), but consumers may pass the camelCase domain form already.
const toConfirmation = (value: unknown): ConfirmationClaim | undefined => {
  if (!isObject(value)) return undefined;
  const v = value;
  const result: ConfirmationClaim = omitUndefined({
    thumbprint: isString(v.thumbprint)
      ? v.thumbprint
      : isString(v.jkt)
        ? v.jkt
        : undefined,
    mtlsCertThumbprint: isString(v.mtlsCertThumbprint)
      ? v.mtlsCertThumbprint
      : isString(v["x5t#S256"])
        ? v["x5t#S256"]
        : undefined,
    key: isObject(v.key)
      ? (v.key as ConfirmationClaim["key"])
      : isObject(v.jwk)
        ? (v.jwk as ConfirmationClaim["key"])
        : undefined,
    keyId: isString(v.keyId) ? v.keyId : isString(v.kid) ? v.kid : undefined,
    jwkSetUri: isString(v.jwkSetUri) ? v.jwkSetUri : isString(v.jku) ? v.jku : undefined,
  });
  return Object.keys(result).length > 0 ? result : undefined;
};

// Claims whose "array" value is space-delimited-string-tolerant on read (they
// accept `"a b"` and split it); the other array claims (`amr`, `entitlements`,
// `groups`, `afr`, …) take arrays only. DERIVED from the registry `array: "spaced"`
// marks — the single source of truth — not a hand-maintained list.
const STRING_ARRAY_DOMAINS = new Set(
  specsWith("array")
    .filter((spec) => spec.array === "spaced")
    .map((spec) => spec.domain),
);

// -----------------------------------------------------------------------------

// Dispatch ONE `bespoke` claim's value to its per-claim JOSE builder, keyed by
// the domain name. Every `value: "bespoke"` registry entry is enumerated here;
// an unhandled bespoke domain is a registry/translator drift and throws loudly
// (the house exhaustive-switch idiom).
const encodeBespoke = (domain: string, value: unknown): unknown => {
  switch (domain) {
    case "accessTokenHash":
    case "codeHash":
    case "stateHash":
      return value; // already-derived b64url string
    case "confirmation":
      return isObject(value) ? confirmationToWire(value as ConfirmationClaim) : undefined;
    case "act":
    case "mayAct":
      return isObject(value) ? actClaimToWire(value as ActClaim) : undefined;
    case "subjectId":
    case "events":
      return isObject(value) ? value : undefined;
    case "authorizationDetails":
      return isArray(value) ? value : undefined;
    case "address":
      // Nested profile object: snake its inner keys, matching the previous
      // `snakeKeys(profile)` write path.
      return isObject(value) ? snakeKeys(value) : value;
    default:
      throw new AegisError("Unhandled bespoke claim domain", {
        code: "translate_unhandled_bespoke_domain",
        data: { domain },
        title: "Unhandled Bespoke Claim Domain",
        details:
          "The claim registry declared a bespoke claim the translator has no builder for.",
      });
  }
};

// Encode ONE registered claim's value to its JOSE wire form per the registry's
// value kind (exhaustive over ClaimValueKind; an unknown kind throws).
const encodeValue = (spec: ClaimSpec, value: unknown): unknown => {
  switch (spec.value) {
    case "text":
    case "int":
    case "array":
    case "bool":
      return value;
    case "date":
      return value instanceof Date ? getUnixTime(value) : undefined;
    case "bstr":
      return value; // JOSE keeps the string; only COSE turns cti into bytes
    case "bespoke":
      return encodeBespoke(spec.domain, value);
    default: {
      const exhaustive: never = spec.value;
      throw new AegisError("Unhandled claim value kind", {
        code: "translate_unhandled_value_kind",
        data: { kind: String(exhaustive) },
        title: "Unhandled Claim Value Kind",
        details:
          "The claim registry declared a value kind the translator has no encoder for.",
      });
    }
  }
};

/**
 * The write core (domain -> wire), single-pass over the claims. Registered
 * claims map to the selected wire NAME with their value encoded per `spec.value`;
 * unregistered custom claims keep their value and flip their KEY to snake_case
 * (R18). Undefined results (an absent value, an empty `cnf`) are dropped. The
 * VALUE encoding is identical for JOSE and COSE — only `nameOf` differs.
 */
const domainToWire = (common: Dict, nameOf: NameSelector): Dict => {
  const wire: Dict = {};

  for (const [key, value] of Object.entries(common)) {
    if (value === undefined) continue;

    const spec = specByDomain(key);
    if (spec) {
      const encoded = encodeValue(spec, value);
      if (encoded !== undefined) wire[nameOf(spec)] = encoded;
    } else {
      wire[snakeCase(key)] = value;
    }
  }

  return wire;
};

/** Domain-keyed common claims -> JOSE-keyed wire dict. */
export const domainToJose = (common: Dict): Dict => domainToWire(common, joseName);

/**
 * Domain-keyed common claims -> COSE-name-keyed wire dict (a single registry
 * pass, NOT `domainToJose` + rename). Identical to `domainToJose` except that a
 * name-diverging claim emits its COSE name (`jti` -> `cti`); the value shapes are
 * the same jose-shaped values the CWT codec then turns into labels + CBOR bytes.
 */
export const domainToCose = (common: Dict): Dict => domainToWire(common, coseName);

export type JoseToDomainResult = {
  claims: Dict;
  custom: Dict;
};

/** COSE read result — same two-bucket shape as {@link JoseToDomainResult}. */
export type CoseToDomainResult = JoseToDomainResult;

// Dispatch ONE `bespoke` claim's value to its per-claim DOMAIN decoder, keyed by
// the domain name — the read-side twin of `encodeBespoke`. Every `value:
// "bespoke"` registry entry is enumerated here; an unhandled bespoke domain is a
// registry/translator drift and throws loudly (the house exhaustive-switch idiom).
const decodeBespoke = (domain: string, value: unknown): unknown => {
  switch (domain) {
    case "accessTokenHash":
    case "codeHash":
    case "stateHash":
      return isString(value) ? value : undefined; // b64url hash string
    case "confirmation":
      return toConfirmation(value);
    case "act":
    case "mayAct":
      return toActClaim(value);
    case "subjectId":
      return isObject(value) ? value : undefined;
    case "authorizationDetails":
      return isArray(value) ? value : undefined;
    case "events":
    case "address":
      return value; // SET events map / address object carried verbatim
    default:
      throw new AegisError("Unhandled bespoke claim domain", {
        code: "translate_unhandled_bespoke_domain",
        data: { domain },
        title: "Unhandled Bespoke Claim Domain",
        details:
          "The claim registry declared a bespoke claim the translator has no decoder for.",
      });
  }
};

// Decode ONE registered claim's value from its wire form to the domain form
// (exhaustive over ClaimValueKind; an unknown kind throws), reproducing
// extract-claims.ts's per-claim decoders exactly. The `array` case refines by
// domain (audience wraps a scalar, the space-delimited set splits a string, the
// rest take arrays only); `bespoke` dispatches to the per-claim decoder table.
const decodeValue = (spec: ClaimSpec, value: unknown): unknown => {
  switch (spec.value) {
    case "text":
      return isString(value) ? value : undefined;
    case "int":
      return isFinite(value) ? value : undefined;
    case "date":
      return toDate(value);
    case "bool":
      return value;
    case "bstr":
      return isString(value) ? value : undefined; // jti
    case "array":
      if (spec.domain === "audience") return toAudience(value);
      if (STRING_ARRAY_DOMAINS.has(spec.domain)) return toStringArray(value);
      return isArray(value) ? value : undefined; // amr, entitlements, groups, afr
    case "bespoke":
      return decodeBespoke(spec.domain, value);
    default: {
      const exhaustive: never = spec.value;
      throw new AegisError("Unhandled claim value kind", {
        code: "translate_unhandled_value_kind",
        data: { kind: String(exhaustive) },
        title: "Unhandled Claim Value Kind",
        details:
          "The claim registry declared a value kind the translator has no decoder for.",
      });
    }
  }
};

/**
 * The read core (wire -> `{ claims, custom }`), single-pass over the registry.
 * Registered claims resolve to `spec.domain` with their value decoded, tolerating
 * either the selected wire name or the camelCase domain name in the input (domain
 * form takes precedence, matching `extractDomainClaims`). Unregistered keys flip
 * to camelCase into `custom` with their value untouched. The VALUE decoding is
 * identical for JOSE and COSE — only `nameOf` differs (`iss`/`exp`/… agree, so
 * only a name-diverging claim like `cti` is looked up differently).
 */
const wireToDomain = (wire: Dict, nameOf: NameSelector): JoseToDomainResult => {
  const consumed = new Set<string>();
  const claims: Dict = {};

  for (const spec of CLAIM_REGISTRY) {
    const wireName = nameOf(spec);
    // Domain (camel) form takes precedence over the wire name, per extract-claims.
    const key =
      spec.domain in wire ? spec.domain : wireName in wire ? wireName : undefined;
    if (key === undefined) continue;

    consumed.add(key);
    const decoded = decodeValue(spec, wire[key]);
    if (decoded !== undefined) claims[spec.domain] = decoded;
  }

  const custom: Dict = {};
  for (const [key, value] of Object.entries(wire)) {
    if (consumed.has(key)) continue;
    custom[camelCase(key)] = value;
  }

  return { claims: omitUndefined(claims), custom };
};

/**
 * JOSE/camel-keyed wire dict -> `{ claims, custom }`.
 *
 * The `{ claims, custom }` two-bucket split is the Phase-2 shape; splitting
 * `profile` / `sensitive` off `claims` is registry-category-driven and lands in
 * a later phase.
 */
export const joseToDomain = (wire: Dict): JoseToDomainResult =>
  wireToDomain(wire, joseName);

/**
 * COSE-name-keyed wire dict (the CWT codec's `decode("map")` output) -> `{ claims,
 * custom }`. The read twin of `domainToCose`: a single registry pass that reads a
 * name-diverging claim under its COSE name (`cti` -> `tokenId`).
 */
export const coseToDomain = (wire: Dict): CoseToDomainResult =>
  wireToDomain(wire, coseName);
