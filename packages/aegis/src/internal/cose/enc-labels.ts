import type { KryptosEncryption } from "@lindorm/kryptos";
import { CoseError } from "../../errors/index.js";

/**
 * COSE content-encryption algorithm labels (IANA COSE Algorithms / RFC 9053
 * §4): the AES-GCM family plus the eight AES-CCM variants. The CCM name encodes
 * its parameters as `AES-CCM-{L}-{tagBits}-{keyBits}`, so the tag length is 8
 * bytes for the `…-64-…` algorithms and 16 bytes for `…-128-…` (GCM is always
 * 16); see `tagBytesForEncryption`.
 */
/**
 * OFFICIAL (non-private-use) COSE content-encryption labels — the interop
 * allowlist (`isOfficialCoseEnc`): the AES-GCM family plus the eight AES-CCM
 * variants (RFC 9053 §4).
 */
const ENC_TO_COSE_OFFICIAL: Readonly<Partial<Record<KryptosEncryption, number>>> = {
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

/**
 * PRIVATE-USE COSE labels (< -65536, RFC 9052 §8) for kryptos encryptions with
 * no OFFICIAL COSE-RFC registration — the AES-CBC-HMAC (RFC 7518 §5.2.3) family,
 * which COSE never registered. Emitted ONLY under proprietary mode; the lenient
 * decrypt path maps them back so a proprietary COSE_Encrypt0 still round-trips.
 */
const ENC_TO_COSE_PRIVATE: Readonly<Partial<Record<KryptosEncryption, number>>> = {
  "A128CBC-HS256": -65537,
  "A192CBC-HS384": -65538,
  "A256CBC-HS512": -65539,
};

const COSE_TO_ENC = Object.fromEntries(
  [...Object.entries(ENC_TO_COSE_OFFICIAL), ...Object.entries(ENC_TO_COSE_PRIVATE)].map(
    ([enc, label]) => [label, enc],
  ),
) as Record<number, KryptosEncryption>;

/**
 * The AEAD authentication-tag length (bytes) for a COSE content-encryption
 * algorithm — the COSE_Encrypt0 ciphertext is `ciphertext‖tag`. GCM is always
 * 16; CCM is 8 (`AES-CCM-{L}-64-…`) or 16 (`AES-CCM-{L}-128-…`); the private-use
 * AES-CBC-HMAC tag is the key-size in bytes (`A{k}CBC-HS{2k}` ⇒ k/8 = 16/24/32).
 */
export const tagBytesForEncryption = (encryption: KryptosEncryption): number => {
  if (encryption.startsWith("AES-CCM-")) {
    // AES-CCM-{L}-{tagBits}-{keyBits}
    return Number(encryption.split("-")[3]) / 8;
  }
  if (encryption.includes("CBC-HS")) {
    // A{keyBits}CBC-HS{macBits}: the truncated MAC tag is keyBits long.
    return Number(encryption.slice(1, encryption.indexOf("CBC"))) / 8;
  }
  return 16; // AES-GCM family
};

/**
 * Interop gate (D5): true iff the encryption has an OFFICIAL (non-private-use)
 * COSE label, i.e. it is COSE-RFC compliant. A non-proprietary `encrypt` refuses
 * anything this returns `false` for.
 */
export const isOfficialCoseEnc = (encryption: KryptosEncryption): boolean =>
  encryption in ENC_TO_COSE_OFFICIAL;

const NOT_SUPPORTED =
  "COSE_Encrypt0 supports the AES-GCM family (A128/A192/A256GCM), the AES-CCM family (AES-CCM-16/64-64/128-128/256), and — in proprietary mode — the AES-CBC-HMAC family.";

export const encToCoseLabel = (
  encryption: KryptosEncryption | null | undefined,
): number => {
  const label = encryption
    ? (ENC_TO_COSE_OFFICIAL[encryption] ?? ENC_TO_COSE_PRIVATE[encryption])
    : undefined;
  if (label === undefined) {
    throw new CoseError(`No COSE label for content encryption "${encryption}"`, {
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
    throw new CoseError(`No content encryption for COSE label "${label}"`, {
      code: "cose_encryption_not_supported",
      data: { label },
      title: "COSE Encryption Not Supported",
      details:
        "The COSE content-encryption label is not one this implementation supports.",
    });
  }
  return encryption;
};
