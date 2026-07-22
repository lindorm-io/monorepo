import type { DomainAssert, VerifyOptions } from "@lindorm/aegis";

// The `aegis.verify` KNOB keys (the `VerifyOptions` surface). Everything else in
// a flat verify-input bag is a `DomainAssert` claim matcher. Kept in lockstep
// with `@lindorm/aegis` VerifyOptions — a knob added there must be added here, or
// it would be misrouted to the positional `assert` argument (and rejected as an
// unknown claim). The two aegis surfaces are disjoint, so the partition is exact.
const VERIFY_OPTION_KEYS: ReadonlyArray<string> = [
  "actor",
  "dpopProof",
  "trustBoundThumbprint",
  "tokenType",
  "key",
  "typPresence",
  "expPresence",
  "accessToken",
  "authCode",
  "authState",
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
