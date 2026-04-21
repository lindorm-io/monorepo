import type { Constructor } from "@lindorm/types";
import { ProteusError } from "../../../../errors/index.js";
import type { IEntity } from "../../../../interfaces/index.js";
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata.js";

/**
 * Resolves the SQLite type affinity for a foreign key column by looking up the
 * referenced entity's primary key field type.
 *
 * SQLite FK columns use TEXT for uuid/string PKs and INTEGER for integer/bigint PKs.
 */
export const resolveFkColumnType = (
  foreignConstructor: () => Constructor<IEntity>,
  foreignPkKey: string,
): string => {
  const foreignTarget = foreignConstructor();
  const foreignMeta = getEntityMetadata(foreignTarget);
  const pkField = foreignMeta.fields.find((f) => f.key === foreignPkKey);

  if (!pkField) {
    throw new ProteusError(
      `Foreign primary key field "${foreignPkKey}" not found on ${foreignMeta.entity.name}`,
    );
  }

  switch (pkField.type) {
    case "integer":
    case "smallint":
    case "bigint":
      return "INTEGER";

    case "uuid":
    case "string":
    case "varchar":
    case "text":
    case "email":
    case "url":
      return "TEXT";

    default:
      return "TEXT";
  }
};
