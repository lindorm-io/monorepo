import type { IProteusSource, ProteusEncryptionKey } from "@lindorm/proteus";
import type { PylonColumnEncKey } from "../../types/index.js";

/**
 * A `PylonColumnEncKey` as a proteus at-rest key selector — a TOTAL mapping:
 * both are the `{ kryptos?, condition? }` descriptor and both members reach
 * proteus, so nothing this path is handed can be silently dropped. (The AEAD
 * that used to be dropped here now lives on `PylonCookieEncKey` alone, where it
 * is honoured.)
 *
 * The cast is the ONE remaining difference and is narrow: the two condition
 * types are near-identical Picks of `AmphoraQuery`, differing only in that
 * pylon's admits `algClass` while proteus's admits the key's `encryption`
 * attribute. It stays a cast rather than a converted shape because the overlap
 * is what any real KEK selector uses.
 */
const toProteusEncryptionKey = (key: PylonColumnEncKey): ProteusEncryptionKey => ({
  kryptos: key.kryptos,
  condition: key.condition as ProteusEncryptionKey["condition"],
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
  key: PylonColumnEncKey,
): Promise<void> => {
  const { Encrypted } = await import("@lindorm/proteus");
  source.stageFieldDecorator(entity, field, Encrypted, toProteusEncryptionKey(key));
};
