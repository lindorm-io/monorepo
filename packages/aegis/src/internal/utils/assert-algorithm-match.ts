import type { Dict } from "@lindorm/types";
import type { AegisError } from "../../errors/index.js";
import type { TokenFormatTag } from "../../types/index.js";

/**
 * The ALGORITHM-MATCH gate every wire kit runs before it spends a signature or
 * decryption cycle: the algorithm the header NAMES must be the algorithm the
 * resolved key actually is. A mismatch then reports what is wrong instead of
 * surfacing as an opaque bad signature or an AEAD failure.
 *
 * The `format` tag namespaces the code and the title, exactly as it does for
 * {@link rejectUnknownCritical}, so a kit cannot invent a spelling.
 */
export const assertAlgorithmMatch = ({
  actual,
  expected,
  format,
  error,
  details,
  data,
}: {
  /** The algorithm the header names. */
  actual: string | undefined;
  /** The algorithm of the configured key. */
  expected: string;
  /** The wire format tag, which namespaces the code and the title. */
  format: TokenFormatTag;
  error: typeof AegisError;
  details: string;
  /**
   * The error `data` bag. Defaults to `{ algorithm: actual }`; the JWE kit
   * overrides it because it has always reported the value under `alg`.
   */
  data?: Dict;
}): void => {
  if (actual === expected) return;

  throw new error("Invalid token", {
    code: `${format}_algorithm_mismatch`,
    data: data ?? { algorithm: actual },
    debug: { expected },
    title: `${format.toUpperCase()} Algorithm Mismatch`,
    details,
  });
};
