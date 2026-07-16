import type { IProteusSource, ProteusEncryptionKey } from "@lindorm/proteus";
import type { PylonEncKey } from "../../types/index.js";

/**
 * A `PylonEncKey` as a proteus at-rest key selector. Both are the shared
 * `{ kryptos?, predicate? }` descriptor, so the mapping is a pass-through; the
 * AEAD `encryption` is meaningless on the `@Encrypted` KEK path (proteus owns
 * the cipher there) and is dropped.
 */
const toProteusEncryptionKey = (key: PylonEncKey): ProteusEncryptionKey => ({
  kryptos: key.kryptos,
  predicate: key.predicate as ProteusEncryptionKey["predicate"],
});

/**
 * Stage the deployment's KEK selector onto a bare `@Encrypted()` field for THIS
 * source only, before `source.setup()` resolves the entity — so the entity ships
 * as a self-documenting, fail-loud marker while the key lives in pylon settings.
 * Must run before the source sets up (proteus throws `staged_after_setup`
 * otherwise).
 *
 * `Encrypted` is loaded dynamically: proteus is an OPTIONAL peer, so pylon's
 * static module graph must never import it (see the iris/proteus optionality
 * contract). The dynamic import is cached, so repeated staging is cheap.
 */
export const stageEncryptedField = async (
  source: IProteusSource,
  entity: Function,
  field: string,
  key: PylonEncKey,
): Promise<void> => {
  const { Encrypted } = await import("@lindorm/proteus");
  source.stageFieldDecorator(entity, field, Encrypted, toProteusEncryptionKey(key));
};
