import type { KryptosEncryption } from "@lindorm/kryptos";
import type { ShaAlgorithm } from "@lindorm/types";
import { CCM_ENCRYPTION_ALGORITHMS } from "@lindorm/types";
import { AesError } from "../../errors/index.js";
import type { AesInternalEncryption } from "../../types/index.js";

/**
 * The cipher family a content encryption belongs to. Drives every place that
 * used to branch on `encryption.includes("GCM")` / `includes("CBC")`:
 *   - `gcm`      — AEAD, tag via the cipher (`getAuthTag`/`setAuthTag`).
 *   - `ccm`      — AEAD, tag via the cipher, but `setAAD` needs `plaintextLength`
 *                  and the nonce/tag sizes vary per algorithm (RFC 9053 §4.2).
 *   - `cbc-hmac` — encrypt-then-MAC; tag is a truncated HMAC over A||IV||E||AL.
 */
export type AesMode = "gcm" | "ccm" | "cbc-hmac";

/**
 * The single source of truth for an AES content encryption's cipher facts.
 * Replaces the scattered per-family switches so adding an algorithm (e.g. the
 * CCM family for COSE) is one table row, not edits across six call sites.
 */
export type AesEncDescriptor = {
  encryption: KryptosEncryption;
  /** Node `crypto` cipher name passed to `createCipheriv`/`createDecipheriv`. */
  nodeCipher: AesInternalEncryption;
  /** Key length handed to the cipher itself (the enc half, always single). */
  cipherKeyBytes: 16 | 24 | 32;
  /** Full content-encryption-key length to generate/derive; 2× cipher key for CBC-HMAC. */
  cekBytes: 16 | 24 | 32 | 48 | 64;
  /** Initialisation vector / nonce length in bytes. */
  ivBytes: number;
  /** Authentication tag length in bytes (the on-the-wire tag). */
  tagBytes: number;
  mode: AesMode;
  /** `true` for GCM and CCM (cipher produces the tag); `false` for CBC-HMAC. */
  aead: boolean;
  /** HMAC hash for CBC-HMAC; `undefined` for AEAD modes. */
  shaAlgorithm?: ShaAlgorithm;
};

const GCM: Record<string, AesEncDescriptor> = {
  A128GCM: {
    encryption: "A128GCM",
    nodeCipher: "aes-128-gcm",
    cipherKeyBytes: 16,
    cekBytes: 16,
    ivBytes: 12,
    tagBytes: 16,
    mode: "gcm",
    aead: true,
  },
  A192GCM: {
    encryption: "A192GCM",
    nodeCipher: "aes-192-gcm",
    cipherKeyBytes: 24,
    cekBytes: 24,
    ivBytes: 12,
    tagBytes: 16,
    mode: "gcm",
    aead: true,
  },
  A256GCM: {
    encryption: "A256GCM",
    nodeCipher: "aes-256-gcm",
    cipherKeyBytes: 32,
    cekBytes: 32,
    ivBytes: 12,
    tagBytes: 16,
    mode: "gcm",
    aead: true,
  },
};

const CBC: Record<string, AesEncDescriptor> = {
  "A128CBC-HS256": {
    encryption: "A128CBC-HS256",
    nodeCipher: "aes-128-cbc",
    cipherKeyBytes: 16,
    cekBytes: 32,
    ivBytes: 16,
    tagBytes: 16,
    mode: "cbc-hmac",
    aead: false,
    shaAlgorithm: "SHA256",
  },
  "A192CBC-HS384": {
    encryption: "A192CBC-HS384",
    nodeCipher: "aes-192-cbc",
    cipherKeyBytes: 24,
    cekBytes: 48,
    ivBytes: 16,
    tagBytes: 24,
    mode: "cbc-hmac",
    aead: false,
    shaAlgorithm: "SHA384",
  },
  "A256CBC-HS512": {
    encryption: "A256CBC-HS512",
    nodeCipher: "aes-256-cbc",
    cipherKeyBytes: 32,
    cekBytes: 64,
    ivBytes: 16,
    tagBytes: 32,
    mode: "cbc-hmac",
    aead: false,
    shaAlgorithm: "SHA512",
  },
};

/**
 * CCM descriptors derived from the algorithm name `AES-CCM-{L}-{tagBits}-{keyBits}`
 * (RFC 9053 §4.2) so the table can never drift from the names: `L` 16 ⇒ 13-byte
 * nonce, 64 ⇒ 7-byte nonce; tag = `tagBits / 8`; key = `keyBits / 8` (128 or 256,
 * AEAD single key). Building these from the registry guarantees all 8 stay in sync.
 */
const CCM: Record<string, AesEncDescriptor> = Object.fromEntries(
  CCM_ENCRYPTION_ALGORITHMS.map((encryption) => {
    const [, , l, tagBits, keyBits] = encryption.split("-");
    const keyBytes = (Number(keyBits) / 8) as 16 | 32;
    return [
      encryption,
      {
        encryption,
        nodeCipher: `aes-${keyBits}-ccm` as AesInternalEncryption,
        cipherKeyBytes: keyBytes,
        cekBytes: keyBytes,
        ivBytes: l === "16" ? 13 : 7,
        tagBytes: Number(tagBits) / 8,
        mode: "ccm",
        aead: true,
      } satisfies AesEncDescriptor,
    ];
  }),
);

const DESCRIPTORS: Record<string, AesEncDescriptor> = { ...GCM, ...CBC, ...CCM };

/**
 * Resolves the cipher descriptor for an AES content encryption. Throws
 * `unsupported_encryption` for anything not in the table.
 */
export const getAesDescriptor = (encryption: KryptosEncryption): AesEncDescriptor => {
  const descriptor = DESCRIPTORS[encryption];

  if (!descriptor) {
    throw new AesError("Unsupported encryption algorithm", {
      code: "unsupported_encryption",
      title: "Unsupported Encryption",
      details:
        "The encryption algorithm is not a supported AES content encryption (GCM, CBC-HMAC, or CCM).",
      data: { encryption },
    });
  }

  return descriptor;
};
