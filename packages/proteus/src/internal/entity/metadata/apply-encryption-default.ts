import { isNull } from "@lindorm/is";
import type { ProteusEncryptionKey } from "../../../types/encryption.js";
import type { EntityMetadata, MetaEncrypted } from "../types/metadata.js";

const isBare = (encrypted: MetaEncrypted): boolean =>
  isNull(encrypted.kryptos) && isNull(encrypted.predicate);

/**
 * Fill every bare `@Encrypted()` field with the source-level `encryption`
 * default, creating a new metadata object. Does NOT mutate the original — entity
 * metadata is shared across sources, and each source may declare a different KEK.
 *
 * The default applies to the descriptor AS A WHOLE, not key by key: `kryptos` and
 * `predicate` are two ways of naming ONE key, not independent knobs. A key-wise
 * merge would let a source-level `kryptos` outrank a decorator's `predicate` —
 * the field would silently encrypt with a key it never asked for, which is the
 * exact hazard this descriptor exists to close.
 */
export const applyEncryptionDefault = (
  metadata: EntityMetadata,
  encryption: ProteusEncryptionKey | undefined,
): EntityMetadata => {
  const fallback: MetaEncrypted = {
    kryptos: encryption?.kryptos ?? null,
    predicate: encryption?.predicate ?? null,
  };

  if (isBare(fallback)) return metadata;

  return {
    ...metadata,
    fields: metadata.fields.map((field) =>
      field.encrypted && isBare(field.encrypted)
        ? { ...field, encrypted: fallback }
        : field,
    ),
  };
};
