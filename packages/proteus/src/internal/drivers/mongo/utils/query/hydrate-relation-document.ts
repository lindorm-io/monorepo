import type { IAmphora } from "@lindorm/amphora";
import type { Document } from "mongodb";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { IncludeProjection } from "../../../../utils/query/include-projection.js";
import { defaultHydrateEntity } from "../../../../entity/utils/default-hydrate-entity.js";
import { resolvePolymorphicMetadata } from "../../../../entity/utils/resolve-polymorphic-metadata.js";
import {
  clearImplicitKeys,
  restrictToProjection,
} from "../../../../utils/query/include-projection.js";
import { documentToRow } from "../hydrate.js";

/**
 * Hydrate one document of a loaded relation.
 *
 * The document is mapped with the FULL foreign metadata — the discriminator has
 * to survive the mapping or a polymorphic target hydrates as its parent class —
 * and only then narrowed to what the caller's `select` asked for. The keys the
 * driver added on its own behalf to match the document to its root are cleared
 * afterwards, so a projection narrows the entity without ever deciding whether
 * the relation matched.
 *
 * A related entity is a read-only projection of the root query: no
 * change-detection snapshot, no hooks — the same as every other driver.
 */
export const hydrateRelationDocument = (
  doc: Document,
  foreignMetadata: EntityMetadata,
  projection: IncludeProjection | null,
  amphora?: IAmphora,
): IEntity => {
  const row = documentToRow(doc, foreignMetadata);
  const effective = resolvePolymorphicMetadata(row, foreignMetadata);

  const entity = defaultHydrateEntity(row, restrictToProjection(effective, projection), {
    snapshot: false,
    hooks: false,
    amphora,
  });

  clearImplicitKeys(entity, projection);

  return entity;
};
