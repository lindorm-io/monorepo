import type { Dict } from "@lindorm/types";
import { describe, expect, test } from "vitest";
import {
  CLAIM_SPECS,
  claimByJose,
  joseName,
} from "../../../internal/claims/claims-registry.js";
import type { ClaimCodec } from "../../../internal/registry/claim-spec.js";
import type { AegisClaimsWire } from "./aegis-claims-wire.js";

/**
 * Drift guard (a): the REGISTERED members of `AegisClaimsWire` (the wire intersection
 * behind `JwtClaimsWire`) must stay in lock-step with `CLAIM_REGISTRY`:
 *   1. their names == the jose names of the registry's PUBLIC claims bucket, and
 *   2. each TS member type matches its codec kind's wire form
 *      (`date`/`int`→number, `array`→Array<string>, `arrayOfObject`→Array<object>,
 *      `object`→a dict, `text`/`bstr`→string, `bool`→boolean; `bespoke` = a
 *      per-claim shape, not uniformly typed, and the ONLY tag left unbound).
 *
 * ⚠ THE WITNESS SPEAKS ONE TOKEN THE CODEC UNION DOES NOT: `arrayOfObject`. The
 * two array forms share a `kind` but NOT a wire type — `Array<string>` against
 * `Array<AuthorizationDetail>` — so a vocabulary that could not tell them apart
 * would have to weaken the array row to "some array" and stop checking the
 * element type of either. {@link wireKindOf} is the one place the codec is read
 * into this vocabulary, so the runtime row below still compares against the
 * REGISTRY rather than against a second hand-kept table.
 *
 * The witness below is `Record<keyof AegisClaimsWire, WireKindTag>`, so a
 * claim added to / removed from `AegisClaimsWire` breaks compilation. Every member
 * is a flat registry claim in `bucket: "claims"` with `sensitivity: "public"`; the
 * sensitive identity claims travel FLAT too but are `sensitivity: "sensitive"`, so
 * they are NOT `AegisClaimsWire` members.
 *
 * ⚠ `jti` and the three OIDC hashes are `text` here, not `bstr`: the byte-string
 * form is a COSE-ONLY per-wire codec (`cti`, `at_hash`/`c_hash`/`s_hash`), and
 * this witness describes the JOSE wire.
 *
 * `satisfies` (not a type annotation) is deliberate: it enforces exact-key
 * coverage of `keyof AegisClaimsWire` yet PRESERVES each entry's literal kind, so the
 * compile-time type binding below can read the per-claim kind.
 */
/**
 * The witness vocabulary: every codec kind, with the array-of-structures form
 * named apart from the array-of-strings one.
 */
type WireKindTag = ClaimCodec["kind"] | "arrayOfObject";

/** Read a registry codec into {@link WireKindTag}. The ONLY reader. */
const wireKindOf = (codec: ClaimCodec): WireKindTag =>
  codec.kind === "array" && codec.of !== undefined ? "arrayOfObject" : codec.kind;

const JWT_CLAIMS_WIRE_KINDS = {
  // RFC 7519 standard claims
  iss: "text",
  sub: "text",
  aud: "array",
  exp: "date",
  nbf: "date",
  iat: "date",
  jti: "text",
  // OIDC Core
  acr: "text",
  amr: "array",
  at_hash: "text",
  auth_time: "date",
  azp: "text",
  c_hash: "text",
  nonce: "text",
  s_hash: "text",
  vot: "text",
  vtm: "text",
  // RFC 7800 proof-of-possession
  cnf: "bespoke",
  // RFC 8693 delegation — a DECLARED member set (`internal/claims/act-members.ts`),
  // recursive: the `act` member's own codec is this same structure.
  act: "object",
  may_act: "object",
  // RFC 9068 authorization
  entitlements: "array",
  groups: "array",
  roles: "array",
  // RFC 7662 token introspection
  username: "text",
  // RFC 9396 rich authorization requests
  authorization_details: "arrayOfObject",
  // RFC 8417 / RFC 9493 security event token
  events: "bespoke",
  // RFC 9493 §3 — a DECLARED member set whose `identifiers` member recurses as an
  // array of Subject Identifiers (RFC 9493 §3.2.8), so the structure is `object`
  // at the claim and a collection one level in.
  sub_id: "object",
  txn: "text",
  // Lindorm assurance axes + proprietary hints
  aal: "int",
  afc: "array",
  afr: "text",
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
} satisfies Record<keyof AegisClaimsWire, WireKindTag>;

// --- Compile-time binding: witness kind -> actual AegisClaimsWire member type ------
//
// `Related<A, B>` is `true` when A and B overlap in EITHER direction — lenient
// enough to accept the narrowed enums (`loa: 1|2|3|4` vs `number`) and the
// `Array<string> | string` conveniences (`scope`/`roles`), yet it rejects a
// fundamentally wrong shape (`exp: string`). `bespoke` is skipped (no uniform
// wire type); `object` is NOT — a declared structure is a dict on the wire
// whatever its members are. If any claim's type drifts from its declared kind the
// mapped type below yields that claim's key instead of `never`, and the final
// assignment fails to compile — naming the offending claim.
type Related<A, B> = [A] extends [B] ? true : [B] extends [A] ? true : false;

type ClaimTypeOk<J extends keyof AegisClaimsWire, K> = K extends "date" | "int"
  ? Related<number, NonNullable<AegisClaimsWire[J]>>
  : K extends "array"
    ? Related<Array<string>, NonNullable<AegisClaimsWire[J]>>
    : K extends "arrayOfObject"
      ? Related<Array<Dict>, NonNullable<AegisClaimsWire[J]>>
      : K extends "object"
        ? Related<Dict, NonNullable<AegisClaimsWire[J]>>
        : K extends "text" | "bstr"
          ? Related<string, NonNullable<AegisClaimsWire[J]>>
          : K extends "bool"
            ? Related<boolean, NonNullable<AegisClaimsWire[J]>>
            : true;

// `-?` strips the optional modifier every `AegisClaimsWire` member carries; without
// it the homomorphic mapped type stays optional and indexing injects `undefined`
// into the union, masking the real result.
type DriftingJwtClaims = {
  [J in keyof AegisClaimsWire]-?: ClaimTypeOk<
    J,
    (typeof JWT_CLAIMS_WIRE_KINDS)[J]
  > extends true
    ? never
    : J;
}[keyof AegisClaimsWire];

// If a member type ever drifts from its wire kind, `DriftingJwtClaims` becomes
// that claim's key and this assignment errors (surfacing the claim name).
const _noJwtClaimTypeDrift: [DriftingJwtClaims] extends [never]
  ? true
  : DriftingJwtClaims = true;
void _noJwtClaimTypeDrift;

describe("JwtClaimsWire / AegisClaimsWire drift guard", () => {
  const registeredClaimsJose = new Set(
    CLAIM_SPECS.filter(
      (spec) => spec.bucket === "claims" && spec.sensitivity === "public",
    ).map(joseName),
  );

  test("AegisClaimsWire keys == the public claims bucket's jose names", () => {
    const witnessKeys = new Set(
      Object.keys(JWT_CLAIMS_WIRE_KINDS) as Array<keyof AegisClaimsWire>,
    );
    expect(witnessKeys).toEqual(registeredClaimsJose);
  });

  test("each AegisClaimsWire member's declared wire kind matches its registry codec kind", () => {
    for (const [jose, kind] of Object.entries(JWT_CLAIMS_WIRE_KINDS)) {
      const spec = claimByJose(jose);
      expect(spec, `no registry entry for jose "${jose}"`).toBeDefined();
      expect(
        spec === undefined ? undefined : wireKindOf(spec.codec),
        `wire-kind drift for jose "${jose}"`,
      ).toBe(kind);
    }
  });
});
