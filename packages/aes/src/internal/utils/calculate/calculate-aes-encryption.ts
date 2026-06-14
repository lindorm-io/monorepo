import type { KryptosEncryption } from "@lindorm/kryptos";
import type { AesInternalEncryption } from "../../../types/index.js";
import { getAesDescriptor } from "../aes-descriptor.js";

/**
 * Maps an AES content encryption to its Node `crypto` cipher name. Delegates to
 * the descriptor table (the single source of truth); kept as a named helper for
 * the call sites that only need the cipher name.
 */
export const calculateAesEncryption = (
  encryption: KryptosEncryption,
): AesInternalEncryption => getAesDescriptor(encryption).nodeCipher;
