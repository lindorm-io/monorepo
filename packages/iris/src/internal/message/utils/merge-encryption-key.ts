import type { IrisEncryptionKey } from "../../../types/encryption.js";
import { hasEncryptionKey } from "./has-encryption-key.js";

/**
 * Resolve a message's own `@Encrypted` descriptor against the source-level
 * `encryption` default.
 *
 * The descriptor is resolved AS A WHOLE, not key by key: `kryptos` and
 * `condition` are two ways of naming ONE key, not independent knobs. A key-wise
 * merge would let a source-level `kryptos` outrank a decorator's `condition` —
 * the message would be sealed with a key it never named, which is the exact
 * hazard this descriptor exists to close. So if the message NAMES a key it wins
 * entirely; otherwise the source default applies entirely.
 */
export const mergeEncryptionKey = (
  key: IrisEncryptionKey,
  fallback: IrisEncryptionKey | undefined,
): IrisEncryptionKey => (hasEncryptionKey(key) ? key : (fallback ?? key));
