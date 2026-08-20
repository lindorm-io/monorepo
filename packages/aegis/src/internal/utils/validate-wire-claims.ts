import type { Condition } from "@lindorm/match";
import type { Dict } from "@lindorm/types";
import type { AegisError } from "../../errors/index.js";
import type { TokenFormatTag, VerifyStructuredTokenOptions } from "../../types/index.js";
import { createTemporalMatchers } from "./jwt-temporal-matchers.js";
import { validate } from "./validate.js";

/**
 * The CLAIMS PASS both claims kits end on: the temporal range (every
 * temporal claim validated IF PRESENT) and the caller's wire `assert` predicate,
 * in ONE pass, so a token is rejected once with the whole list of failing claims
 * rather than at whichever check happened to run first.
 *
 * ⚠ The claims arrive ALREADY DATE-LIFTED, and that is the honest divergence
 * this does not absorb: `JwtKit` lifts a JOSE NumericDate integer through
 * `withJoseDates`, while the CBOR claims codec yields `Date`s on the way out of
 * `decodeCwtMessage`. Integer-vs-CBOR is encoding, so it stays wire-side; what
 * the matchers then do to a `Date` is the same on both wires.
 *
 * ⚠ `clockTolerance` is already RESOLVED. Each kit settles its own precedence —
 * a per-call override over its constructed default — before calling.
 */
export const validateWireClaims = <C extends Dict = Dict>({
  claims,
  assert,
  options,
  clockTolerance,
  format,
  error,
}: {
  /** The Date-lifted wire claims. */
  claims: C;
  /** The caller's own predicate over the same wire claims, if any. */
  assert: Condition<C> | undefined;
  options: VerifyStructuredTokenOptions;
  /** Seconds, already resolved against the kit's own default. */
  clockTolerance: number;
  /** The wire format tag, which namespaces the refusal code. */
  format: TokenFormatTag;
  error: typeof AegisError;
}): void =>
  validate(
    claims,
    {
      ...createTemporalMatchers({
        clockTolerance,
        currentDate: options.currentDate,
        maxTokenAge: options.maxTokenAge,
        verifyExpiration: options.verifyExpiration,
        verifyNotBefore: options.verifyNotBefore,
        verifyIssuedAt: options.verifyIssuedAt,
        verifyAuthTime: options.verifyAuthTime,
      }),
      // ⚠ THE CALLER'S `assert` WINS ON A SHARED KEY, and the shared keys are the
      // TEMPORAL ones. `assert: { exp: { $exists: true } }` REPLACES the expiry
      // bound `createTemporalMatchers` built rather than conjoining with it, so a
      // caller adding a presence check to `exp`/`nbf`/`iat`/`auth_time` stands
      // the range check down without asking. The knobs that are MEANT to waive a
      // range are the explicit ones (`verifyExpiration` and its siblings, which
      // is why they exist), so this precedence is a silent second way to reach
      // the same state. Not changed here — the merge semantics are the owner's
      // call, not a bug fix. Filed as finding L-3 in
      // `lindorm-monorepo/.claude/condition-language-plan.md`, reached from the
      // "condition-language leftovers" item in `TODO-MONOREPO.md`.
      ...(assert ?? {}),
    } as Condition<C>,
    // The claims kits are PURE WIRE, so a failure here is a kit failure under
    // the kit's own wire-spelled code — never the domain's neutral one.
    error,
    `${format}_claims_invalid`,
  );
