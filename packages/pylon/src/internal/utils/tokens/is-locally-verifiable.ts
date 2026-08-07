import { Aegis } from "@lindorm/aegis";

/**
 * Is this credential one aegis can verify locally? SNIFFED from the wire format,
 * never discovered by attempting a verify and treating the failure as "must be
 * opaque" — a tampered JWT must FAIL, not fall through to introspection where an
 * authorization server would be asked about a string it never issued.
 *
 * `Aegis.isJose` / `Aegis.isCose` are the same structural discriminators
 * `aegis.verify` itself dispatches on (`internal/utils/verify-token.ts`), so this
 * predicate is exactly congruent with "verify can select a kit for it": anything
 * it accepts, verify will process; anything it rejects, verify would refuse with
 * `unsupported_token_type`.
 */
export const isLocallyVerifiable = (token: string): boolean =>
  Aegis.isJose(token) || Aegis.isCose(token);
