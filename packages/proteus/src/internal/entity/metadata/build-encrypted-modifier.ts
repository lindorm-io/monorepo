import { isEmpty, isUndefined } from "@lindorm/is";
import type { ProteusEncryptionKey } from "../../../types/encryption.js";
import type { MetaEncrypted } from "../types/metadata.js";

/**
 * Normalise an `@Encrypted` selector into a fully-resolved `MetaEncrypted`.
 *
 * The single source of truth for how a `ProteusEncryptionKey` becomes staged
 * metadata — shared by the `@Encrypted` decorator and `ProteusUtil` so the two
 * never drift. Both normalisations collapse "no named key" to `null`:
 *
 * - `kryptos` — `undefined` → `null` (a key was not handed over outright).
 * - `condition` — `undefined` OR an EMPTY condition → `null`. `find({})`
 *   resolves to "any internal enc key, newest first", the unscoped lookup a
 *   named-key field exists to forbid, so `{}` reads as bare exactly like
 *   `undefined`: the field then takes the source default or throws
 *   `unnamed_encryption_key` at load, never silently encrypting with a key it
 *   never named.
 */
export const buildEncryptedModifier = (
  options?: ProteusEncryptionKey,
): MetaEncrypted => ({
  kryptos: isUndefined(options?.kryptos) ? null : options.kryptos,
  condition: options?.condition && !isEmpty(options.condition) ? options.condition : null,
});
