import type { IrisEncryptionKey } from "../../../types/encryption.js";

/**
 * Merge a message's own `@Encrypted` descriptor over the source-level default.
 * Shallow, caller-wins: the decorator has the last word on every key it names.
 *
 * A `kryptos` beats a `predicate` when both survive the merge — an injected key
 * never came from the vault, so there is nothing left to query.
 */
export const mergeEncryptionKey = (
  key: IrisEncryptionKey,
  fallback: IrisEncryptionKey | undefined,
): IrisEncryptionKey => ({
  kryptos: key.kryptos ?? fallback?.kryptos,
  predicate: { ...fallback?.predicate, ...key.predicate },
});
