import { describe, expect, test } from "vitest";
import { CLAIMS_REGISTRY } from "../../../internal/claims/claims-registry.js";
import type { JwtWireClaims } from "./jwt-wire-claims.js";
import type { CwtWireClaims } from "./cwt-wire-claims.js";

/**
 * Drift guard (b): `CwtWireClaims`' omit/add transformation must equal the
 * registry `coseName` divergence set — `CLAIM_REGISTRY.filter(s => s.coseName &&
 * s.coseName !== s.jose)`, today just `{ jose: "jti", coseName: "cti" }`. The
 * transformation is bound BOTH ways: a registry change is caught at runtime
 * (below), and the type-level checks force `CwtWireClaims` to actually carry the
 * COSE name and drop the JOSE name.
 */

// The registry-mirrored divergence witness: jose name -> diverging cose name.
// The runtime test binds this to `CLAIM_REGISTRY`; the type checks bind it to
// the actual `CwtWireClaims` / `JwtWireClaims` member types.
const COSE_NAME_DIVERGENCES = { jti: "cti" } as const;
type Divergences = typeof COSE_NAME_DIVERGENCES;

// --- Compile-time binding to the ACTUAL exported wire types ------------------
//
// Both types carry an open index signature, so `keyof` is useless (every string
// is a key). Instead we probe member ACCESS: a REGISTERED member resolves to its
// specific type (e.g. `string`), while a member that only exists through the
// index resolves to `unknown`. For each divergence:
//   - the JOSE name is a real (typed) member of `JwtWireClaims`,
//   - the JOSE name is NOT a real member of `CwtWireClaims` (dropped),
//   - the COSE name IS a real member of `CwtWireClaims` (added),
//   - the COSE name is NOT a real member of `JwtWireClaims`.
// An index-only member is EXACTLY `unknown`; a real member is a concrete type
// (`string`, an object, a union, …). `unknown extends T` holds only when T is
// itself `unknown`, so it cleanly separates the two.
type IsReal<T> = unknown extends T ? false : true;

type DivergenceDrift = {
  [Jose in keyof Divergences]: IsReal<JwtWireClaims[Jose]> extends true
    ? IsReal<CwtWireClaims[Jose]> extends false
      ? IsReal<CwtWireClaims[Divergences[Jose]]> extends true
        ? IsReal<JwtWireClaims[Divergences[Jose]]> extends false
          ? never
          : Divergences[Jose] // cose name leaked into JwtWireClaims
        : Divergences[Jose] // cose name missing from CwtWireClaims
      : Jose // jose name not dropped from CwtWireClaims
    : Jose; // jose name missing from JwtWireClaims
}[keyof Divergences];

// If any divergence is not fully applied, `DivergenceDrift` names the offending
// claim and this assignment fails to compile.
const _noCwtDivergenceDrift: [DivergenceDrift] extends [never] ? true : DivergenceDrift =
  true;
void _noCwtDivergenceDrift;

describe("CwtWireClaims drift guard", () => {
  test("witness divergences == registry coseName divergences", () => {
    const registryDivergences = CLAIMS_REGISTRY.filter(
      (spec) => spec.coseName && spec.coseName !== spec.jose,
    ).map((spec) => `${spec.jose}->${spec.coseName}`);

    const witnessDivergences = Object.entries(COSE_NAME_DIVERGENCES).map(
      ([jose, cose]) => `${jose}->${cose}`,
    );

    expect(new Set(witnessDivergences)).toEqual(new Set(registryDivergences));
  });

  test("the only JOSE↔COSE name divergence is RFC 8392 jti↔cti", () => {
    const registryDivergences = CLAIMS_REGISTRY.filter(
      (spec) => spec.coseName && spec.coseName !== spec.jose,
    ).map((spec) => ({ jose: spec.jose, coseName: spec.coseName }));

    expect(registryDivergences).toEqual([{ jose: "jti", coseName: "cti" }]);
  });
});
