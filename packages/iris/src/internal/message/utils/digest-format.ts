import { IrisMetadataError } from "../../../errors/IrisMetadataError.js";
import type { SensitiveDigest } from "../types/metadata.js";

// SHA family pinned to the house ShaKit static output — unpadded base64url.
const SHA256_REGEX = /^[A-Za-z0-9_-]{43}$/;
const SHA384_REGEX = /^[A-Za-z0-9_-]{64}$/;
const SHA512_REGEX = /^[A-Za-z0-9_-]{86}$/;

// Legacy interop only — the toolkit never produces md5.
const MD5_REGEX = /^[0-9a-f]{32}$/i;

// Strict PHC string as produced by the argon2 npm lib (fixed m,t,p param order,
// unpadded standard base64 salt/hash) — the shape behind @lindorm/enigma.
const ARGON2_REGEX =
  /^\$argon2(?:id|i|d)\$v=\d+\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/;

/**
 * Expected carried-value format for a @Sensitive digest algorithm. Format
 * validation only — iris never hashes or verifies; it just catches the one bug
 * that matters (a plaintext value sent in a hash field).
 */
export const digestFormatRegex = (digest: SensitiveDigest): RegExp => {
  switch (digest) {
    case "sha256":
      return SHA256_REGEX;

    case "sha384":
      return SHA384_REGEX;

    case "sha512":
      return SHA512_REGEX;

    case "md5":
      return MD5_REGEX;

    case "argon2":
      return ARGON2_REGEX;

    default:
      throw new IrisMetadataError(`Unknown sensitive digest "${digest as string}"`, {
        code: "unknown_sensitive_digest",
        title: "Unknown Sensitive Digest",
        details: `The @Sensitive digest "${digest as string}" is not a recognised algorithm — expected one of "sha256", "sha384", "sha512", "md5", or "argon2".`,
        debug: { digest: digest as string },
      });
  }
};
