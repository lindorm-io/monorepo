import { NotSupportedError, ProteusError } from "../../../../errors/index.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { buildEnumColumnType } from "./build-enum-column-type.js";
import { mapFieldTypeMysql } from "./map-field-type-mysql.js";

/**
 * Resolves the MySQL column type for a foreign key column from the referenced
 * entity's primary-key field — through the SAME mappers as the PK column itself
 * (`buildEnumColumnType` / `mapFieldTypeMysql`, plus the encrypted→TEXT rule), so
 * FK and referenced PK column types agree by construction. InnoDB rejects foreign
 * keys between mismatched types, and cannot place a key on TEXT/BLOB/JSON columns
 * at all — a referenced PK mapping to one of those (an `@Encrypted` PK, or a
 * string PK without `max`) throws with an actionable pointer.
 *
 * `foreignMeta` is the referenced entity's RESOLVED metadata (not re-read from the
 * constructor), matching postgres and the source's naming strategy.
 */
export const resolveFkColumnType = (
  foreignMeta: EntityMetadata,
  foreignPkKey: string,
): string => {
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

  // An @Encrypted PK column is stored as TEXT (project-column-type), and InnoDB
  // cannot place a foreign key on a TEXT column — surface it clearly rather than
  // resolving the raw type and letting InnoDB reject a varchar-vs-text mismatch.
  if (pkField.encrypted) {
    throw new NotSupportedError(
      `Primary key "${foreignPkKey}" on ${foreignMeta.entity.name} is encrypted (stored as TEXT) — MySQL cannot reference it with a foreign key`,
      {
        code: "unsupported_column_type",
        title: "Unsupported Column Type",
        details:
          "An @Encrypted primary key is stored as a TEXT column, and InnoDB cannot place a foreign key on TEXT. Reference a non-encrypted primary key.",
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
