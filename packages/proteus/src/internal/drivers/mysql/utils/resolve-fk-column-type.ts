import type { Constructor } from "@lindorm/types";
import { ProteusError } from "../../../../errors/index.js";
import type { IEntity } from "../../../../interfaces/index.js";
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata.js";

/**
 * Resolves the MySQL column type for a foreign key column by looking up the
 * referenced entity's primary key field type.
 *
 * MySQL FK columns use CHAR(36) for uuid PKs, VARCHAR(255) for string PKs,
 * and the appropriate integer type for integer PKs.
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
    case "smallint":
      return "SMALLINT";
    case "integer":
      return "INT";
    case "bigint":
      return "BIGINT";
    case "uuid":
      return "CHAR(36)";
    case "string":
    case "varchar":
      return `VARCHAR(${pkField.max ?? 255})`;
    case "text":
      return "TEXT";
    case "email":
      return "VARCHAR(320)";
    case "url":
      return "TEXT";
    default:
      return "VARCHAR(255)";
  }
};
