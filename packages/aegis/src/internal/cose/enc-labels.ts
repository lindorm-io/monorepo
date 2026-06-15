import type { KryptosEncryption } from "@lindorm/kryptos";
import { AegisError } from "../../errors/index.js";

/**
 * COSE content-encryption algorithm labels (IANA COSE Algorithms). GCM is
 * supported for COSE_Encrypt0 today; AES-CCM (labels 10-13 / 30-33) is a
 * follow-up. The tag is always 16 bytes (128-bit) for the GCM family.
 */
const ENC_TO_COSE: Readonly<Partial<Record<KryptosEncryption, number>>> = {
  A128GCM: 1,
  A192GCM: 2,
  A256GCM: 3,
};

const COSE_TO_ENC = Object.fromEntries(
  Object.entries(ENC_TO_COSE).map(([enc, label]) => [label, enc]),
) as Record<number, KryptosEncryption>;

/** GCM authentication tag length (bytes) — the COSE_Encrypt0 ciphertext is `ct‖tag`. */
export const GCM_TAG_BYTES = 16;

export const encToCoseLabel = (
  encryption: KryptosEncryption | null | undefined,
): number => {
  const label = encryption ? ENC_TO_COSE[encryption] : undefined;
  if (label === undefined) {
    throw new AegisError(`No COSE label for content encryption "${encryption}"`, {
      code: "cose_encryption_not_supported",
      data: { encryption },
      title: "COSE Encryption Not Supported",
      details:
        "COSE_Encrypt0 currently supports the AES-GCM family (A128GCM/A192GCM/A256GCM); AES-CCM is a follow-up.",
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
