import type { AesDecryptionRecord } from "@lindorm/aes";
import { B64 } from "@lindorm/b64";
import type { KryptosEncAlgorithm } from "@lindorm/kryptos";
import { JweError } from "../../errors/index.js";
import type { DomainTokenHeader } from "../../types/index.js";
import { B64U } from "../constants/format.js";
import { isBase64UrlEncoding } from "./is-base64url-encoding.js";

type KeyManagementBytes = Pick<
  AesDecryptionRecord,
  "pbkdfSalt" | "publicEncryptionIv" | "publicEncryptionTag"
>;

type KeyManagementByteParameter = "iv" | "tag" | "p2s";

const NONE: KeyManagementBytes = {
  pbkdfSalt: undefined,
  publicEncryptionIv: undefined,
  publicEncryptionTag: undefined,
};

const REFUSAL: Record<KeyManagementByteParameter, { code: string; title: string }> = {
  iv: { code: "jwe_header_iv_invalid", title: "JWE Header Iv Invalid" },
  tag: { code: "jwe_header_tag_invalid", title: "JWE Header Tag Invalid" },
  p2s: { code: "jwe_header_p2s_invalid", title: "JWE Header P2s Invalid" },
};

const requireHeaderBytes = (
  parameter: KeyManagementByteParameter,
  value: unknown,
): Buffer => {
  if (isBase64UrlEncoding(value)) return B64.toBuffer(value, B64U);

  throw new JweError(`Invalid token header: ${parameter} must be base64url`, {
    ...REFUSAL[parameter],
    details: `The JWE header ${parameter} is absent or is not a base64url string, and the key-management algorithm requires it.`,
  });
};

/**
 * The header bytes the key-management algorithm consumes, decoded; a parameter
 * it does not consume is never read. RFC 7516 §5.2, RFC 7515 §4,
 * RFC 7518 §4.7.1, RFC 7518 §4.8.1. pinned: jwe-key-management-header.test.ts.
 */
export const readKeyManagementBytes = (
  algorithm: KryptosEncAlgorithm,
  header: DomainTokenHeader,
): KeyManagementBytes => {
  switch (algorithm) {
    case "A128GCMKW":
    case "A192GCMKW":
    case "A256GCMKW":
    case "ECDH-ES+A128GCMKW":
    case "ECDH-ES+A192GCMKW":
    case "ECDH-ES+A256GCMKW":
      return {
        ...NONE,
        publicEncryptionIv: requireHeaderBytes("iv", header.initialisationVector),
        publicEncryptionTag: requireHeaderBytes("tag", header.publicEncryptionTag),
      };

    case "PBES2-HS256+A128KW":
    case "PBES2-HS384+A192KW":
    case "PBES2-HS512+A256KW":
      return { ...NONE, pbkdfSalt: requireHeaderBytes("p2s", header.pbkdfSalt) };

    case "dir":
    case "A128KW":
    case "A192KW":
    case "A256KW":
    case "ECDH-ES":
    case "ECDH-ES+A128KW":
    case "ECDH-ES+A192KW":
    case "ECDH-ES+A256KW":
    case "RSA-OAEP":
    case "RSA-OAEP-256":
    case "RSA-OAEP-384":
    case "RSA-OAEP-512":
      return NONE;

    default: {
      const exhaustive: never = algorithm;
      throw new JweError("Unhandled key-management algorithm", {
        code: "jwe_unhandled_key_management_algorithm",
        debug: { algorithm: String(exhaustive) },
        title: "JWE Unhandled Key Management Algorithm",
        details:
          "This kit is configured with a key whose algorithm is not a JWE key-management algorithm, such as a signing key, so it cannot decrypt the token; configure an encryption key.",
      });
    }
  }
};
