import type { DomainAssert, VerifyOptions } from "@lindorm/aegis";
import { VERIFY_OPTION_KEYS } from "@lindorm/aegis";

// The `aegis.verify` KNOB keys come from aegis, which owns them: they are derived
// from its wire-parity table, so a field added to or removed from `VerifyOptions`
// moves this split with it.
//
// ⚠ This WAS a hand-copied second list, and it failed twice. When
// `tokenType`/`accessToken`/`authCode`/`authState` moved from `VerifyOptions` to
// `DomainAssert`, the copy still routed all four to `options`, where verify no
// longer reads them — accepted and DROPPED, not rejected, so a `tokenType`
// assertion silently stopped being made and no typecheck could see it.
// `clockTolerance` drifted the other way: declared on `VerifyOptions` and missing
// from the copy, so a per-call tolerance was misrouted to `assert` and rejected
// as an unknown claim. Do not re-inline the list.

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
    // `some` rather than `includes`: the imported list is typed
    // `ReadonlyArray<keyof VerifyOptions>`, and a runtime bag holds plain strings.
    if (VERIFY_OPTION_KEYS.some((option) => option === key)) {
      options[key] = value;
    } else {
      assert[key] = value;
    }
  }

  return { assert: assert as DomainAssert, options: options as VerifyOptions };
};
