import type { DomainAssert, VerifyOptions } from "@lindorm/aegis";

// The `aegis.verify` KNOB keys (the `VerifyOptions` surface). Everything else in
// a flat verify-input bag is a `DomainAssert` claim matcher.
//
// ⚠ A SECOND COPY of a fact `@lindorm/aegis` owns, and it has already failed
// once: when `tokenType`/`accessToken`/`authCode`/`authState` moved from
// `VerifyOptions` to `DomainAssert`, this list still routed all four to
// `options`, where verify no longer reads them — accepted and DROPPED, not
// rejected, so a `tokenType` assertion silently stopped being made and no
// typecheck could see it. `clockTolerance` had drifted the other way: declared
// on `VerifyOptions` and missing here, so a per-call tolerance was misrouted to
// `assert` and rejected as an unknown claim.
//
// It survives for `createTokenMiddleware` alone, whose PUBLIC option bag is flat
// (matchers and knobs mixed). The fix that removes the copy is to split that bag
// into explicit halves — which changes a public surface, so it is not made here.
const VERIFY_OPTION_KEYS: ReadonlyArray<string> = [
  "actor",
  "clockTolerance",
  "currentDate",
  "maxTokenAge",
  "verifyExpiration",
  "verifyNotBefore",
  "verifyIssuedAt",
  "verifyAuthTime",
  "dpopProof",
  "trustBoundThumbprint",
  "key",
  "typPresence",
  "expPresence",
];

/**
 * Split a flat `aegis.verify` input bag (the historical `VerifyJwtOptions` shape
 * — claim matchers AND verify knobs mixed together) into the positional
 * `(assert, options)` pair the reshaped `aegis.verify(token, assert, options)`
 * expects. Claim-matcher keys (`audience`/`issuer`/`scope`/the folded-in equality
 * claims) route to `assert`; verify knobs route to `options`. A blind rename
 * would silently drop the matchers, so the split is explicit.
 */
export const splitVerifyInput = (
  input: DomainAssert & VerifyOptions,
): { assert: DomainAssert; options: VerifyOptions } => {
  const assert: Record<string, unknown> = {};
  const options: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (VERIFY_OPTION_KEYS.includes(key)) {
      options[key] = value;
    } else {
      assert[key] = value;
    }
  }

  return { assert: assert as DomainAssert, options: options as VerifyOptions };
};
