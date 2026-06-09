import type { Dict } from "@lindorm/types";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import type { MemoryTable } from "../types/memory-store.js";
import { MemoryDuplicateKeyError } from "../errors/MemoryDuplicateKeyError.js";

export const checkUniqueConstraints = (
  table: MemoryTable,
  row: Dict,
  metadata: EntityMetadata,
  excludePk: string | null,
): void => {
  for (const unique of metadata.uniques) {
    const columns = unique.keys;

    // Skip if all unique columns are null (SQL NULL != NULL semantics)
    const allNull = columns.every((col) => row[col] == null);
    if (allNull) continue;

    for (const [pk, existingRow] of table) {
      if (pk === excludePk) continue;

      const matches = columns.every(
        (col) =>
          row[col] != null && existingRow[col] != null && row[col] === existingRow[col],
      );

      if (matches) {
        throw new MemoryDuplicateKeyError(
          `Unique constraint violation for "${metadata.entity.name}" on columns [${columns.join(", ")}]`,
          {
            code: "unique_violation",
            title: "Unique Violation",
            details: `Another "${metadata.entity.name}" row already holds the same value on the unique columns [${columns.join(", ")}].`,
            data: { entityName: metadata.entity.name, columns },
            debug: {
              values: columns.map((c) => row[c]),
            },
          },
        );
      }
    }
  }
};
