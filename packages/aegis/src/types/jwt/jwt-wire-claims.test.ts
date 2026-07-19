import { describe, expect, test } from "vitest";
import type { ClaimValueKind } from "../../internal/claims/registry.js";
import { CLAIM_REGISTRY, specByJose } from "../../internal/claims/registry.js";
import type { JwtClaims } from "../claims/jwt/jwt-claims.js";

/**
 * Drift guard (a): the REGISTERED members of `JwtClaims` (the wire intersection
 * behind `JwtWireClaims`) must stay in lock-step with `CLAIM_REGISTRY`:
 *   1. their names == the registry `category:"claims"` jose names, and
 *   2. each TS member type matches its `ClaimValueKind` wire form
 *      (`date`/`int`→number, `array`→Array<string>, `text`/`bstr`→string,
 *      `bool`→boolean; `bespoke` = per-claim object shape, not uniformly typed).
 *
 * The witness below is `Record<keyof JwtClaims, ClaimValueKind | null>`, so a
 * claim added to / removed from `JwtClaims` breaks compilation. `null` marks the
 * one member that is NOT a flat registry claim — the legacy nested
 * `sensitive_identity` claim (Phase 13 flattens it); everything else is
 * runtime-checked against the registry.
 *
 * `satisfies` (not a type annotation) is deliberate: it enforces exact-key
 * coverage of `keyof JwtClaims` yet PRESERVES each entry's literal kind, so the
 * compile-time type binding below can read the per-claim kind.
 */
const JWT_CLAIMS_WIRE_KINDS = {
  // RFC 7519 standard claims
  iss: "text",
  sub: "text",
  aud: "array",
  exp: "date",
  nbf: "date",
  iat: "date",
  jti: "bstr",
  // OIDC Core
  acr: "text",
  amr: "array",
  at_hash: "bespoke",
  auth_time: "date",
  azp: "text",
  c_hash: "bespoke",
  nonce: "text",
  s_hash: "bespoke",
  vot: "text",
  vtm: "text",
  // RFC 7800 proof-of-possession
  cnf: "bespoke",
  // RFC 8693 delegation
  act: "bespoke",
  may_act: "bespoke",
  // RFC 9068 authorization
  entitlements: "array",
  groups: "array",
  roles: "array",
  // RFC 9396 rich authorization requests
  authorization_details: "bespoke",
  // RFC 8417 / RFC 9493 security event token
  events: "bespoke",
  sub_id: "bespoke",
  txn: "text",
  // Lindorm assurance axes + proprietary hints
  aal: "int",
  afr: "array",
  client_id: "text",
  conforms_to: "array",
  fal: "int",
  gty: "text",
  ial: "int",
  loa: "int",
  permissions: "array",
  scope: "array",
  sid: "text",
  sih: "text",
  suh: "text",
  tenant_id: "text",
  // Legacy nested PII claim — NOT a flat registry claim (Phase 13 flattens it).
  sensitive_identity: null,
} satisfies Record<keyof JwtClaims, ClaimValueKind | null>;

// --- Compile-time binding: witness kind -> actual JwtClaims member type ------
//
// `Related<A, B>` is `true` when A and B overlap in EITHER direction — lenient
// enough to accept the narrowed enums (`loa: 1|2|3|4` vs `number`) and the
// `Array<string> | string` conveniences (`scope`/`roles`), yet it rejects a
// fundamentally wrong shape (`exp: string`). `bespoke`/`null` are skipped (no
// uniform wire type). If any claim's type drifts from its declared kind the
// mapped type below yields that claim's key instead of `never`, and the final
// assignment fails to compile — naming the offending claim.
type Related<A, B> = [A] extends [B] ? true : [B] extends [A] ? true : false;

type ClaimTypeOk<J extends keyof JwtClaims, K> = K extends "date" | "int"
  ? Related<number, NonNullable<JwtClaims[J]>>
  : K extends "array"
    ? Related<Array<string>, NonNullable<JwtClaims[J]>>
    : K extends "text" | "bstr"
      ? Related<string, NonNullable<JwtClaims[J]>>
      : K extends "bool"
        ? Related<boolean, NonNullable<JwtClaims[J]>>
        : true;

// `-?` strips the optional modifier every `JwtClaims` member carries; without
// it the homomorphic mapped type stays optional and indexing injects `undefined`
// into the union, masking the real result.
type DriftingJwtClaims = {
  [J in keyof JwtClaims]-?: ClaimTypeOk<J, (typeof JWT_CLAIMS_WIRE_KINDS)[J]> extends true
    ? never
    : J;
}[keyof JwtClaims];

// If a member type ever drifts from its wire kind, `DriftingJwtClaims` becomes
// that claim's key and this assignment errors (surfacing the claim name).
const _noJwtClaimTypeDrift: [DriftingJwtClaims] extends [never]
  ? true
  : DriftingJwtClaims = true;
void _noJwtClaimTypeDrift;

describe("JwtWireClaims / JwtClaims drift guard", () => {
  const registeredClaimsJose = new Set(
    CLAIM_REGISTRY.filter((spec) => spec.category === "claims").map((spec) => spec.jose),
  );

  test("registered JwtClaims keys == registry category:claims jose names", () => {
    const witnessRegisteredKeys = new Set(
      (Object.keys(JWT_CLAIMS_WIRE_KINDS) as Array<keyof JwtClaims>).filter(
        (key) => JWT_CLAIMS_WIRE_KINDS[key] !== null,
      ),
    );
    expect(witnessRegisteredKeys).toEqual(registeredClaimsJose);
  });

  test("the only non-registry JwtClaims member is the legacy nested sensitive_identity", () => {
    const nested = (Object.keys(JWT_CLAIMS_WIRE_KINDS) as Array<keyof JwtClaims>).filter(
      (key) => JWT_CLAIMS_WIRE_KINDS[key] === null,
    );
    expect(new Set(nested)).toEqual(new Set(["sensitive_identity"]));
  });

  test("each JwtClaims member's declared wire kind matches its registry value kind", () => {
    for (const [jose, kind] of Object.entries(JWT_CLAIMS_WIRE_KINDS)) {
      if (kind === null) continue;
      const spec = specByJose(jose);
      expect(spec, `no registry entry for jose "${jose}"`).toBeDefined();
      expect(spec?.value, `wire-kind drift for jose "${jose}"`).toBe(kind);
    }
  });
});
