// Per-source @Encrypted staging for the TCK harnesses.
//
// `source.stageFieldDecorator(...)` may only run AFTER the source is constructed
// but BEFORE setup() — it throws `staged_after_setup` otherwise. Every driver
// harness therefore calls this between `new ProteusSource(...)` and
// `source.setup()`, so the staging suite runs identically on all six drivers.

import type { Constructor } from "@lindorm/types";
import type { ProteusSource } from "../../../classes/ProteusSource.js";
import { Encrypted } from "../../../decorators/Encrypted.js";
import type { IEntity } from "../../../interfaces/index.js";
import { TCK_STAGED_PREDICATE } from "./create-tck-amphora.js";

/**
 * Override `TckStagedEncrypted.stagedSecret`'s @Encrypted selector on THIS source
 * only, naming the STAGED KEK instead of the source-level default. Its sibling
 * `defaultSecret` is left bare, so it still resolves the source default — proving
 * staging is per-field, not global.
 *
 * A no-op when the driver lacks the encryption capability (the entity is then not
 * in `entities`). The class is matched by name because the harness only sees the
 * flat target array, not the named `TckEntities` object; the class it finds is
 * the exact one the source will register, so reference-based staging still holds.
 */
export const stageTckEncryptions = (
  source: ProteusSource,
  entities: Array<Constructor<IEntity>>,
): void => {
  const target = entities.find((entity) => entity.name === "TckStagedEncrypted");
  if (!target) return;

  source.stageFieldDecorator(target, "stagedSecret", Encrypted, {
    predicate: { ...TCK_STAGED_PREDICATE },
  });
};
