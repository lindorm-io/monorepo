import type { Predicate } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";

export const buildConflictPredicate = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  conflictOn: Array<keyof E>,
): Predicate<E> => {
  const predicate: Record<string, unknown> = {};

  for (const key of conflictOn) {
    const value = (entity as any)[key];

    if (value == null) {
      throw new ProteusRepositoryError(
        `Cannot build conflict predicate: field "${String(key)}" is null or undefined on "${metadata.entity.name}"`,
        {
          code: "missing_conflict_key",
          title: "Missing Conflict Key",
          details:
            "Every conflictOn field must be populated before building a conflict predicate.",
          debug: { key: String(key), entityName: metadata.entity.name },
        },
      );
    }

    predicate[key as string] = value;
  }

  return predicate as Predicate<E>;
};
