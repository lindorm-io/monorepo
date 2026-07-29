import type { Condition } from "@lindorm/match";
import type { IEntity } from "../../../interfaces/index.js";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";

export const buildPrimaryKeyPredicate = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
): Condition<E> => {
  const predicate: Record<string, unknown> = {};

  for (const key of metadata.primaryKeys) {
    const value = (entity as any)[key];

    if (value == null) {
      throw new ProteusRepositoryError(
        `Cannot build primary key predicate: field "${key}" is null or undefined on "${metadata.entity.name}"`,
        {
          code: "missing_primary_key",
          title: "Missing Primary Key",
          details:
            "Every primary key field must be populated before building a primary key predicate.",
          debug: { key, entityName: metadata.entity.name },
        },
      );
    }

    predicate[key] = value;
  }

  return predicate as Condition<E>;
};
