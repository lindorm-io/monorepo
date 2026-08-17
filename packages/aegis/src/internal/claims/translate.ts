import { camelCase, camelKeys, snakeCase, snakeKeys } from "@lindorm/case";
import { getUnixTime } from "@lindorm/date";
import { isArray, isFinite, isObject, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import { AegisDomainError } from "../../errors/index.js";
import type { ActClaim, ActClaimWire, ConfirmationClaim } from "../../types/index.js";
import type { ArrayScalar, BespokeKind, ClaimCodec } from "../registry/claim-spec.js";
import {
  CLAIM_SPECS,
  type ClaimSpec,
  claimByDomain,
  joseName,
  type NameSelector,
} from "./claims-registry.js";

/**
 * The ONE claim translator. It consolidates every claim mapper that existed
 * before — `map-content-to-claims.ts` (domain -> jose, write), the hand-written
 * `extractDomainClaims` (jose/camel -> domain, read), and the `domain <-> jose`
 * remap loops around `CWT_CLAIMS_KIT` in `cwt-claims.ts` — into a single
 * registry-driven, single-PASS pair per direction.
 *
 * ⚠ The read half of `extract-claims.ts` was not merely a second caller: it held
 * FIVE value decoders character-identical to the ones below (`toDate`,
 * `toStringArray`, `toAudience`, `toActClaim`, `toConfirmation`) plus a
 * hand-listed field-by-field extraction of ~45 claims. All of it is gone; what
 * genuinely differed survives as {@link ClaimReadMode}, and nothing else.
 *
 * TWO parameterized cores (write / read), and the wire is a PARAMETER of both.
 * The ONLY thing that varies between JOSE and COSE is the wire NAME emitted or
 * looked up — `joseName` vs `coseName` (the RFC 8392 divergence set, today just
 * `jti` <-> `cti`). The VALUE transforms are identical at this level; only the
 * downstream CWT codec turns the jose-shaped values into COSE labels and CBOR
 * bytes. There is deliberately no `domainToCose` / `coseToDomain` pair: a second
 * named entry point per wire is a second place for a rule to be written
 * differently, which is exactly what this file exists to remove.
 *
 * It is the ONLY domain-aware claim code: both the JOSE and the COSE format
 * paths meet here. Value transforms come from the registry's `ClaimCodec`; a
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
// variants of both cores — now lives on the registry that owns the divergence,
// so the identity-matcher builder keys its predicate by the same rule.

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

// --- Value decoders (read side) ----------------------------------------------

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

// -----------------------------------------------------------------------------

// Dispatch ONE `bespoke` claim's value to its per-claim JOSE builder, keyed by
// the registry codec's `bespoke` sub-kind. Every {@link BespokeKind} is
// enumerated here; an unhandled sub-kind (the `undefined` fall-through of a
// registry/translator drift) throws loudly (the house exhaustive-switch idiom).
const encodeBespoke = (
  spec: ClaimSpec,
  bespoke: BespokeKind,
  value: unknown,
): unknown => {
  switch (bespoke) {
    case "confirmation":
      return isObject(value) ? confirmationToWire(value as ConfirmationClaim) : undefined;
    case "act":
      return isObject(value) ? actClaimToWire(value as ActClaim) : undefined;
    case "subId":
    case "events":
      return isObject(value) ? value : undefined;
    case "authDetails":
      return isArray(value) ? value : undefined;
    case "address":
      // Nested profile object: snake its inner keys, matching the previous
      // `snakeKeys(profile)` write path.
      return isObject(value) ? snakeKeys(value) : value;
    default: {
      const exhaustive: never = bespoke;
      throw new AegisDomainError("Unhandled bespoke claim sub-kind", {
        code: "translate_unhandled_bespoke_domain",
        data: { domain: spec.domain, bespoke: String(exhaustive) },
        title: "Unhandled Bespoke Claim Sub-Kind",
        details:
          "The claim registry declared a bespoke claim the translator has no builder for.",
      });
    }
  }
};

// Encode ONE registered claim's value to its JOSE wire form per the registry
// codec (exhaustive over ClaimCodec; an unknown kind throws).
//
// The translator reads the BASE codec, never a per-wire override: it produces
// the jose-shaped values BOTH wires start from, and the COSE byte layer
// (`cose/cwt-spec.ts`) applies the per-wire codec when it turns those values into
// labels and CBOR bytes. That is why `bstr` — a COSE-only codec — returns the
// value untouched here.
const encodeValue = (spec: ClaimSpec, value: unknown): unknown => {
  const codec = spec.codec;

  switch (codec.kind) {
    case "text":
    case "int":
    case "array":
    case "bool":
      return value;
    case "date":
      return value instanceof Date ? getUnixTime(value) : undefined;
    case "bstr":
      return value; // JOSE keeps the string; only COSE turns it into bytes
    case "bespoke":
      return encodeBespoke(spec, codec.bespoke, value);
    default: {
      // The `never` binding is on `codec` — that is what makes the compiler bite
      // on a new ClaimCodec member. The REPORTED fact must be the `kind` STRING:
      // stringifying the codec OBJECT yields "[object Object]" and loses the one
      // fact this handler exists to name.
      const exhaustive: never = codec;
      throw new AegisDomainError("Unhandled claim value kind", {
        code: "translate_unhandled_value_kind",
        data: { kind: String((exhaustive as ClaimCodec).kind) },
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
 *
 * EXPORTED, and the only write door: the wire is a PARAMETER, so there is no
 * `domainToJose` / `domainToCose` pair to keep in agreement. `Aegis.toWire` binds
 * `joseName` because the public vocabulary door speaks JOSE.
 */
export const domainToWire = (common: Dict, nameOf: NameSelector): Dict => {
  const wire: Dict = {};

  for (const [key, value] of Object.entries(common)) {
    if (value === undefined) continue;

    const spec = claimByDomain(key);
    if (spec) {
      const encoded = encodeValue(spec, value);
      if (encoded !== undefined) wire[nameOf(spec)] = encoded;
    } else {
      wire[snakeCase(key)] = value;
    }
  }

  return wire;
};

/**
 * Domain-keyed common claims -> JOSE-keyed wire dict. The PUBLIC vocabulary door
 * (`Aegis.toWire`), which speaks JOSE because the domain engine does; every
 * internal write site calls {@link domainToWire} with its own codec's selector.
 */
export const domainToJose = (common: Dict): Dict => domainToWire(common, joseName);

export type WireToDomainResult = {
  claims: Dict;
  custom: Dict;
};

// Dispatch ONE `bespoke` claim's value to its per-claim DOMAIN decoder, keyed by
// the registry codec's `bespoke` sub-kind — the read-side twin of
// `encodeBespoke`. Every {@link BespokeKind} is enumerated here; an unhandled
// sub-kind (a registry/translator drift) throws loudly (the house
// exhaustive-switch idiom).
const decodeBespoke = (
  spec: ClaimSpec,
  bespoke: BespokeKind,
  value: unknown,
): unknown => {
  switch (bespoke) {
    case "confirmation":
      return toConfirmation(value);
    case "act":
      return toActClaim(value);
    case "subId":
      return isObject(value) ? value : undefined;
    case "authDetails":
      return isArray(value) ? value : undefined;
    case "events":
      // A SET events map is keyed by event-type URIs (RFC 8417 §2.2). Those are
      // identifiers, not field names — case-converting them would rewrite the
      // URI. Carried verbatim, and it must NOT join the `address` arm below.
      return value;
    case "address":
      // The mirror of the encode side's `snakeKeys`. OIDC Core §5.1 defines the
      // wire address with snake keys (`street_address`, `postal_code`); the
      // domain form is camel like every other claim. Without this the round trip
      // is asymmetric and hands snake keys back into a camel-typed shape.
      return isObject(value) ? camelKeys(value) : value;
    default: {
      const exhaustive: never = bespoke;
      throw new AegisDomainError("Unhandled bespoke claim sub-kind", {
        code: "translate_unhandled_bespoke_domain",
        data: { domain: spec.domain, bespoke: String(exhaustive) },
        title: "Unhandled Bespoke Claim Sub-Kind",
        details:
          "The claim registry declared a bespoke claim the translator has no decoder for.",
      });
    }
  }
};

// How an array claim tolerates a SCALAR on read, per the codec's own policy.
// This used to be a hardcoded `spec.domain === "audience"` branch plus a set
// derived from the registry; it is one exhaustive switch over registry data now.
//
// The `default` is NOT redundant: the declared return type is `unknown`, so
// falling off the end is legal and a new {@link ArrayScalar} member would compile
// clean and DROP the claim on read. The `never` binding is what makes the
// compiler bite instead (the house exhaustive-switch idiom, as in
// `encodeBespoke`/`decodeBespoke`).
const decodeArray = (spec: ClaimSpec, scalar: ArrayScalar, value: unknown): unknown => {
  switch (scalar) {
    case "wrap":
      return toAudience(value); // RFC 7519 aud: string-OR-array
    case "spaced":
      return toStringArray(value); // scope, roles, permissions, conformsTo
    case "strict":
      return isArray(value) ? value : undefined; // amr, entitlements, groups, afc
    default: {
      const exhaustive: never = scalar;
      throw new AegisDomainError("Unhandled array scalar policy", {
        code: "translate_unhandled_array_scalar",
        data: { domain: spec.domain, scalar: String(exhaustive) },
        title: "Unhandled Array Scalar Policy",
        details:
          "The claim registry declared an array scalar-tolerance policy the translator has no decoder for.",
      });
    }
  }
};

// Decode ONE registered claim's value from its wire form to the domain form
// (exhaustive over ClaimCodec; an unknown kind throws), reproducing
// hand-written per-claim decoders exactly. The `array` case refines by the
// codec's own scalar-tolerance policy — `wrap` for `aud` (RFC 7519 string-OR-
// array), `spaced` for the space-delimited sets, `strict` for the rest — which
// used to be a hardcoded `spec.domain === "audience"` branch here.
const decodeValue = (spec: ClaimSpec, value: unknown): unknown => {
  const codec = spec.codec;

  switch (codec.kind) {
    case "text":
      return isString(value) ? value : undefined;
    case "int":
      return isFinite(value) ? value : undefined;
    case "date":
      return toDate(value);
    case "bool":
      return value;
    case "bstr":
      return isString(value) ? value : undefined; // the JOSE string form
    case "array":
      return decodeArray(spec, codec.scalar, value);
    case "bespoke":
      return decodeBespoke(spec, codec.bespoke, value);
    default: {
      // See `encodeValue`: the `never` binding is the compiler backstop, but the
      // REPORTED fact must be the string discriminant — `String(codec)` on the
      // codec object reads "[object Object]".
      const exhaustive: never = codec;
      throw new AegisDomainError("Unhandled claim value kind", {
        code: "translate_unhandled_value_kind",
        data: { kind: String((exhaustive as ClaimCodec).kind) },
        title: "Unhandled Claim Value Kind",
        details:
          "The claim registry declared a value kind the translator has no decoder for.",
      });
    }
  }
};

/**
 * WHICH claims a read pass resolves, WHICH input names it will answer to, and
 * what becomes of the keys it does not consume. Three facts, one closed set, so
 * a fourth door cannot be added by accident.
 *
 *   - `"token"`  reading a TOKEN's wire payload. A registered claim resolves ONLY
 *                under its wire name; an unregistered key flips snake -> camelCase
 *                into `custom` (R18). This is what verify/parse/decrypt read.
 *   - `"floor"`  the profiled verify FLOOR read of a token: wire names only, only
 *                `domainClaim`-marked claims resolve (the {@link DomainClaims}
 *                set), and every other key stays in `custom` VERBATIM.
 *   - `"dict"`   the PUBLIC vocabulary door (`Aegis.toDomain`), whose input is a
 *                claim dict of unknown provenance — an introspection response, a
 *                userinfo body, or an already-domain-shaped set. It therefore
 *                answers to EITHER spelling, domain form winning.
 *
 * ⚠⚠ The wire-name-only rule on the two TOKEN modes is the load-bearing one.
 * Which claim an ISSUER stated is decided by the registered wire claim and by
 * nothing else; letting a look-alike custom claim answer under the domain
 * spelling hands that decision to whoever presents the token. A token carrying
 * both `aud: ["someone-else"]` and a custom `audience: [me]` must fail the
 * audience floor on the `aud` it actually states.
 *
 * ⚠⚠ `"floor"`'s verbatim rule is equally load-bearing. The floor asks "is this
 * claim present ON THE WIRE"; case-converting first would let a wire `expires_at`
 * camelCase to `expiresAt` and satisfy an `exp`-presence floor. A profile may
 * also name a required claim in its WIRE spelling (`introspection` names
 * `token_introspection`), which only resolves against a verbatim `custom`.
 */
export type ClaimReadMode = "token" | "floor" | "dict";

/**
 * What a {@link ClaimReadMode} decides, resolved ONCE per read.
 *   - `resolves`   whether the pass looks this registered claim up at all.
 *   - `lookup`     which input key, if any, the claim is read from.
 *   - `customKey`  how a key the pass did not consume is spelled in `custom`.
 *
 * The three facts travel together because they are one policy, and deciding them
 * in a single `switch` is what makes a fourth mode a COMPILE error rather than a
 * silent fall into another door's behaviour — the failure a scatter of
 * `mode === "floor"` ternaries invites.
 */
type ClaimReadRules = {
  resolves: (spec: ClaimSpec) => boolean;
  lookup: (spec: ClaimSpec, wireName: string, wire: Dict) => string | undefined;
  customKey: (key: string) => string;
};

/**
 * ⚠ BOTH LOOKUPS USE `Object.hasOwn`, NEVER `in`.
 *
 * `wire` is a STRANGER'S payload — a decoded token, or the dict a public door
 * was handed — and `in` walks the prototype chain, so `toString`, `constructor`,
 * `valueOf`, `hasOwnProperty` and `__proto__` are members of every object
 * literal that ever reaches here. A registry name colliding with one of those
 * would make the lookup answer YES for a claim the payload does not carry, and
 * the decoder would then read a FUNCTION off `Object.prototype` as a claim value.
 *
 * ⚠ Stated honestly: no registered domain or wire name collides today, so this
 * is a LATENT fault and not a live one — `translate.test.ts` derives that
 * non-collision from the registry rather than asserting it from memory, which is
 * what would go red the day a claim named `constructor` is registered. The house
 * rule stands regardless: a membership test whose KEY can come from a caller uses
 * `Object.hasOwn`, because the alternative is a fault that only announces itself
 * through a wrong answer.
 */

/** A token states a claim under its WIRE name. Nothing else answers for it. */
const wireLookup = (
  _spec: ClaimSpec,
  wireName: string,
  wire: Dict,
): string | undefined => (Object.hasOwn(wire, wireName) ? wireName : undefined);

/** The public dict door accepts either spelling; the domain form wins. */
const eitherLookup = (
  spec: ClaimSpec,
  wireName: string,
  wire: Dict,
): string | undefined =>
  Object.hasOwn(wire, spec.domain)
    ? spec.domain
    : Object.hasOwn(wire, wireName)
      ? wireName
      : undefined;

const claimReadRules = (mode: ClaimReadMode): ClaimReadRules => {
  switch (mode) {
    case "token":
      return { resolves: () => true, lookup: wireLookup, customKey: camelCase };
    case "floor":
      return {
        resolves: (spec) => spec.domainClaim !== undefined,
        lookup: wireLookup,
        customKey: (key) => key,
      };
    case "dict":
      return { resolves: () => true, lookup: eitherLookup, customKey: camelCase };
    default: {
      const exhaustive: never = mode;
      throw new AegisDomainError("Unhandled claim read mode", {
        code: "translate_unhandled_read_mode",
        data: { mode: String(exhaustive) },
        title: "Unhandled Claim Read Mode",
        details: "A ClaimReadMode member has no rules in the claim read core.",
      });
    }
  }
};

/**
 * The read core (wire -> `{ claims, custom }`), single-pass over the registry.
 * Registered claims resolve to `spec.domain` with their value decoded. The VALUE
 * decoding is identical for JOSE and COSE and for every read mode — only `nameOf`
 * and the {@link ClaimReadMode} differ.
 *
 * Exported because `resolve-domain-buckets.ts` continues from here to the
 * four-bucket shape every read door shares.
 *
 * ⚠ This TWO-bucket form is the right one for the profiled verify FLOOR, which
 * needs every domain claim flat in one dict: a profile's `required` rules may name a
 * profile-category claim, and bucketing it away would report a present claim as
 * missing.
 */
export const wireToDomain = (
  wire: Dict,
  nameOf: NameSelector,
  mode: ClaimReadMode,
): WireToDomainResult => {
  const rules = claimReadRules(mode);
  const consumed = new Set<string>();
  const claims: Dict = {};

  for (const spec of CLAIM_SPECS) {
    // The floor read resolves ONLY the extracted set; every other registered
    // claim is left for `custom`, verbatim, exactly as it arrived.
    if (!rules.resolves(spec)) continue;

    const key = rules.lookup(spec, nameOf(spec), wire);
    if (key === undefined) continue;

    consumed.add(key);
    const decoded = decodeValue(spec, wire[key]);
    if (decoded !== undefined) claims[spec.domain] = decoded;
  }

  const custom: Dict = {};
  for (const [key, value] of Object.entries(wire)) {
    if (consumed.has(key)) continue;
    custom[rules.customKey(key)] = value;
  }

  return { claims: omitUndefined(claims), custom };
};

/**
 * The verify-FLOOR read: a token's raw wire claims -> `{ claims, custom }` where
 * `claims` is the {@link DomainClaims} set and `custom` holds every remaining key
 * under its ORIGINAL spelling. The profiled verify pipeline flattens the two back
 * together and asks the floor what is present.
 *
 * The wire is a PARAMETER: both wires reach this one read, so a claim spelling a
 * floor accepts cannot diverge between them.
 */
export const wireToFloorClaims = (
  wire: Dict,
  nameOf: NameSelector,
): WireToDomainResult => {
  const { claims, custom } = wireToDomain(wire, nameOf, "floor");

  // ⚠ A key the pass did NOT consume that is spelled like a claim the floor
  // resolves can only be a LOOK-ALIKE: the real claim would have been consumed
  // under its wire name. The floor's caller flattens `custom` and `claims` into
  // one dict, so leaving it in would let a presenter-supplied `audience` answer
  // for an ABSENT `aud` — a token that states no audience clearing the audience
  // floor. Which claim the issuer stated is decided by the registered wire claim
  // and by nothing else, and that has to hold when the claim is missing too.
  //
  // Only the RESOLVED set is filtered. A profile may require a claim under its
  // wire spelling (`introspection` requires `token_introspection`) or a claim the
  // floor does not resolve at all (`events`), and both must survive verbatim.
  const filtered: Dict = {};
  for (const [key, value] of Object.entries(custom)) {
    if (floorShadows(key)) continue;
    filtered[key] = value;
  }

  return { claims, custom: filtered };
};

/** The DOMAIN names the floor read resolves — the set a custom key may not impersonate. */
const FLOOR_DOMAINS = new Set(
  CLAIM_SPECS.filter((spec) => spec.domainClaim !== undefined).map((spec) => spec.domain),
);

const floorShadows = (key: string): boolean => FLOOR_DOMAINS.has(key);
