import type { KryptosEncryption } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { getAesDescriptor } from "../aes-descriptor.js";

/**
 * Generates a random IV/nonce sized for the encryption: 12 bytes (GCM), 16
 * bytes (CBC), or 13/7 bytes (CCM, per the algorithm's `L` parameter). Size
 * comes from the descriptor table, not a per-family branch.
 */
export const getInitialisationVector = (encryption: KryptosEncryption): Buffer =>
  randomBytes(getAesDescriptor(encryption).ivBytes);
