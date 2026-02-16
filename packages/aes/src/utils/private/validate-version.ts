import { AES_FORMAT_MAJOR } from "../../constants/private";
import { AesError } from "../../errors";

/**
 * Validates an AES format version string.
 *
 * - Rejects legacy integer versions (old format, no longer supported).
 * - Parses "X.Y" semver-like strings and rejects incompatible major versions.
 * - Accepts any minor version within the same major (backward compatible).
 */
export const validateAesVersion = (v: string): string => {
  // Legacy integer versions: if the entire string is a plain integer, reject
  if (/^\d+$/.test(v)) {
    throw new AesError("Legacy AES version format is no longer supported", {
      debug: { version: v },
    });
  }

  // Must be "X.Y" format
  const match = /^(\d+)\.(\d+)$/.exec(v);

  if (!match) {
    throw new AesError("Invalid AES version format", {
      debug: { version: v, expected: "X.Y" },
    });
  }

  const major = parseInt(match[1], 10);

  if (major !== AES_FORMAT_MAJOR) {
    throw new AesError("Incompatible AES version", {
      debug: { version: v, expectedMajor: AES_FORMAT_MAJOR },
    });
  }

  return v;
};
