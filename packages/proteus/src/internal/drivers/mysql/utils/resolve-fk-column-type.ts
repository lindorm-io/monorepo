import type { Constructor } from "@lindorm/types";
import { NotSupportedError, ProteusError } from "../../../../errors/index.js";
import type { IEntity } from "../../../../interfaces/index.js";
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata.js";
import { buildEnumColumnType } from "./build-enum-column-type.js";
import { mapFieldTypeMysql } from "./map-field-type-mysql.js";

/**
 * Resolves the MySQL column type for a foreign key column from the referenced
 * entity's primary-key field — through the SAME mappers as the PK column itself
 * (`buildEnumColumnType` / `mapFieldTypeMysql`), so FK and referenced PK column
 * types agree by construction. InnoDB rejects foreign keys between mismatched
 * types, and cannot place a key on TEXT/BLOB/JSON columns at all — a referenced
 * PK mapping to one of those (e.g. a string PK without `max`) throws with a
 * pointer to declare `max` on the primary-key field.
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
      {
        code: "schema_mismatch",
        title: "Schema Mismatch",
        details:
          "The referenced foreign primary key field does not exist on the foreign entity, so the FK column type cannot be resolved.",
        data: { column: foreignPkKey, entity: foreignMeta.entity.name },
      },
    );
  }

  const type = buildEnumColumnType(pkField) ?? mapFieldTypeMysql(pkField);

  if (["TEXT", "BLOB", "JSON"].includes(type)) {
    throw new NotSupportedError(
      `Primary key "${foreignPkKey}" on ${foreignMeta.entity.name} maps to ${type} — MySQL cannot reference it with a foreign key`,
      {
        code: "unsupported_column_type",
        title: "Unsupported Column Type",
        details:
          "InnoDB cannot place a key on TEXT, BLOB, or JSON columns. Declare a max length on the referenced primary-key field (e.g. a string field needs `max`) so it maps to VARCHAR.",
        data: { column: foreignPkKey, entity: foreignMeta.entity.name, type },
      },
    );
  }

  return type;
};
