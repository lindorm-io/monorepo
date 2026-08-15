import type { AegisError } from "../../errors/index.js";
import type { TokenFormatTag } from "../../types/index.js";

/**
 * The KID FAIL-FAST both claims kits run: a token naming a key id other than the
 * configured key's cannot verify, so it is refused before the expensive
 * signature cycle. Reached through Aegis the handed key already matches; this
 * protects the STANDALONE kit.
 *
 * ⚠ It is a claims-kit gate and stays one. `JwsKit` and `JweKit` have never had
 * a kid fail-fast, and extracting this must not give them one — that would be a
 * new refusal on the opaque and encrypted doors, not a restructure.
 *
 * ⚠ Absence is NOT a mismatch. A token carrying no `kid` names no key, and a key
 * carrying no id cannot be named by one, so only two PRESENT values that DIFFER
 * are refused. A missing kid is answered by the signature, which is the check
 * that can actually tell.
 *
 * The `format` tag namespaces the code and the title, exactly as it does for
 * {@link assertAlgorithmMatch}, so a kit cannot invent a spelling.
 */
export const assertKidMatch = ({
  actual,
  expected,
  format,
  error,
}: {
  /** The key id the token names. */
  actual: string | undefined;
  /** The id of the configured key. */
  expected: string | undefined;
  /** The wire format tag, which namespaces the code and the title. */
  format: TokenFormatTag;
  error: typeof AegisError;
}): void => {
  if (!actual || !expected || actual === expected) return;

  throw new error("Invalid token", {
    code: `${format}_kid_mismatch`,
    data: { kid: actual },
    debug: { expected },
    title: `${format.toUpperCase()} Kid Mismatch`,
    details:
      "The token's kid names a different key than the one configured on this kit, so it cannot be verified here.",
  });
};
