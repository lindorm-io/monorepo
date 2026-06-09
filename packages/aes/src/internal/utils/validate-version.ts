import { AES_FORMAT_MAJOR } from "../constants/version.js";
import { AesError } from "../../errors/AesError.js";

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
      code: "legacy_version_unsupported",
      title: "Legacy Version Unsupported",
      details:
        "The AES version is a legacy integer format that is no longer supported; a 'X.Y' version is required.",
      data: { version: v },
    });
  }

  // Must be "X.Y" format
  const match = /^(\d+)\.(\d+)$/.exec(v);

  if (!match) {
    throw new AesError("Invalid AES version format", {
      code: "invalid_version_format",
      title: "Invalid Version Format",
      details: "The AES version must be in 'X.Y' format where X and Y are integers.",
      data: { version: v, expected: "X.Y" },
    });
  }

  const major = parseInt(match[1], 10);

  if (major !== AES_FORMAT_MAJOR) {
    throw new AesError("Incompatible AES version", {
      code: "incompatible_version",
      title: "Incompatible Version",
      details:
        "The AES version has a major number that does not match the major version supported by this library.",
      data: { version: v, expectedMajor: AES_FORMAT_MAJOR },
    });
  }

  return v;
};
