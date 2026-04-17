import type { Dict } from "@lindorm/types";
import type { EntityMetadata } from "../../../entity/types/metadata";
import type { MemoryTable } from "../types/memory-store";
import { MemoryDuplicateKeyError } from "../errors/MemoryDuplicateKeyError";

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
            debug: {
              entityName: metadata.entity.name,
              columns,
              values: columns.map((c) => row[c]),
            },
          },
        );
      }
    }
  }
};
