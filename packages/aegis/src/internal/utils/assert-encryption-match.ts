import type { AegisError } from "../../errors/index.js";
import type { TokenFormatTag } from "../../types/index.js";

/**
 * The CONTENT-ENCRYPTION-MATCH gate the encrypting kits run before they spend a
 * decryption cycle: the AEAD the wire NAMES must be the one this kit is
 * configured to accept.
 *
 * ⚠ IT IS A CONFIGURATION CONTRACT, NOT A DOWNGRADE DEFENCE. On both wires the
 * value is inside the AEAD's integrity coverage, so an in-flight attacker cannot
 * rewrite it — a mismatch is chosen by whoever PRODUCED the token. What the gate
 * buys is that `defaultEncryption`, and a key's own declared `encryption`, mean
 * the same thing on the read side as on the write side instead of being ignored.
 *
 * The `format` tag namespaces the code and the title, exactly as it does for
 * {@link assertAlgorithmMatch}, so a kit cannot invent a spelling.
 */
export const assertEncryptionMatch = ({
  actual,
  expected,
  format,
  error,
  details,
}: {
  /** The content encryption the wire names. */
  actual: string | undefined;
  /** The content encryption this kit is configured to accept. */
  expected: string;
  /** The wire format tag, which namespaces the code and the title. */
  format: TokenFormatTag;
  error: typeof AegisError;
  details: string;
}): void => {
  if (actual === expected) return;

  throw new error("Unexpected encryption", {
    code: `${format}_encryption_mismatch`,
    debug: { actual, encryption: expected },
    title: `${format.toUpperCase()} Encryption Mismatch`,
    details,
  });
};
