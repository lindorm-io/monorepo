import { ProteusError } from "../../../../errors/index.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { mapFieldTypeSqlite } from "./map-field-type-sqlite.js";

/**
 * Resolves the SQLite column type for a foreign key column from the referenced
 * entity's primary-key field, through the SAME mapper as the PK column itself
 * (`mapFieldTypeSqlite`) so the FK type equals the referenced PK type by
 * construction. A bespoke INTEGER/TEXT switch drifted: a `decimal` PK is NUMERIC,
 * a `binary` PK is BLOB, a `real` PK is REAL — all of which the switch mapped to
 * TEXT, producing an affinity mismatch against the PK column.
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
          "The referenced foreign primary-key field does not exist on the target entity.",
        data: { entity: foreignMeta.entity.name, column: foreignPkKey },
      },
    );
  }

  return mapFieldTypeSqlite(pkField);
};
