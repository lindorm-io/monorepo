import type { KryptosEncryption } from "@lindorm/kryptos";
import { AegisError } from "../../errors/index.js";

/**
 * COSE content-encryption algorithm labels (IANA COSE Algorithms / RFC 9053
 * §4): the AES-GCM family plus the eight AES-CCM variants. The CCM name encodes
 * its parameters as `AES-CCM-{L}-{tagBits}-{keyBits}`, so the tag length is 8
 * bytes for the `…-64-…` algorithms and 16 bytes for `…-128-…` (GCM is always
 * 16); see `tagBytesForEncryption`.
 */
const ENC_TO_COSE: Readonly<Partial<Record<KryptosEncryption, number>>> = {
  A128GCM: 1,
  A192GCM: 2,
  A256GCM: 3,
  "AES-CCM-16-64-128": 10,
  "AES-CCM-16-64-256": 11,
  "AES-CCM-64-64-128": 12,
  "AES-CCM-64-64-256": 13,
  "AES-CCM-16-128-128": 30,
  "AES-CCM-16-128-256": 31,
  "AES-CCM-64-128-128": 32,
  "AES-CCM-64-128-256": 33,
};

const COSE_TO_ENC = Object.fromEntries(
  Object.entries(ENC_TO_COSE).map(([enc, label]) => [label, enc]),
) as Record<number, KryptosEncryption>;

/**
 * The AEAD authentication-tag length (bytes) for a COSE content-encryption
 * algorithm — the COSE_Encrypt0 ciphertext is `ciphertext‖tag`. GCM is always
 * 16; CCM is 8 (`AES-CCM-{L}-64-…`) or 16 (`AES-CCM-{L}-128-…`).
 */
export const tagBytesForEncryption = (encryption: KryptosEncryption): number => {
  if (encryption.startsWith("AES-CCM-")) {
    // AES-CCM-{L}-{tagBits}-{keyBits}
    return Number(encryption.split("-")[3]) / 8;
  }
  return 16; // AES-GCM family
};

const NOT_SUPPORTED =
  "COSE_Encrypt0 supports the AES-GCM family (A128/A192/A256GCM) and the AES-CCM family (AES-CCM-16/64-64/128-128/256).";

export const encToCoseLabel = (
  encryption: KryptosEncryption | null | undefined,
): number => {
  const label = encryption ? ENC_TO_COSE[encryption] : undefined;
  if (label === undefined) {
    throw new AegisError(`No COSE label for content encryption "${encryption}"`, {
      code: "cose_encryption_not_supported",
      data: { encryption },
      title: "COSE Encryption Not Supported",
      details: NOT_SUPPORTED,
    });
  }
  return label;
};

export const coseLabelToEnc = (label: number): KryptosEncryption => {
  const encryption = COSE_TO_ENC[label];
  if (encryption === undefined) {
    throw new AegisError(`No content encryption for COSE label "${label}"`, {
      code: "cose_encryption_not_supported",
      data: { label },
      title: "COSE Encryption Not Supported",
      details:
        "The COSE content-encryption label is not one this implementation supports.",
    });
  }
  return encryption;
};
