import type { KryptosEncryption } from "@lindorm/kryptos";
import type { AesKeyLength } from "@lindorm/types";
import { getAesDescriptor } from "../aes-descriptor.js";

/**
 * Returns the full content-encryption-key size to generate/derive for an
 * encryption: the cipher key for AEAD (GCM/CCM), or 2× the cipher key for
 * CBC-HMAC (which splits the CEK into a MAC half + an enc half). Sourced from
 * the descriptor table.
 */
export const calculateContentEncryptionKeySize = (
  encryption: KryptosEncryption,
): AesKeyLength => getAesDescriptor(encryption).cekBytes;
