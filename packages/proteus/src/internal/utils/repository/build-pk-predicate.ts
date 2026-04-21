import type { Predicate } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";

export const buildPrimaryKeyPredicate = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
): Predicate<E> => {
  const predicate: Record<string, unknown> = {};

  for (const key of metadata.primaryKeys) {
    const value = (entity as any)[key];

    if (value == null) {
      throw new ProteusRepositoryError(
        `Cannot build primary key predicate: field "${key}" is null or undefined on "${metadata.entity.name}"`,
        { debug: { key, entityName: metadata.entity.name } },
      );
    }

    predicate[key] = value;
  }

  return predicate as Predicate<E>;
};
