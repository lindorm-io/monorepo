import { Constructor, DeepPartial } from "@lindorm/types";
import { EntityMetadataError } from "../errors";
import { IEntity } from "../interfaces";
import { globalEntityMetadata } from "./global";

export const verifyReadonly = <E extends IEntity>(
  target: Constructor<E>,
  entity: DeepPartial<E>,
): void => {
  const metadata = globalEntityMetadata.get(target);

  for (const key of Object.keys(entity)) {
    const column = metadata.columns.find((c) => c.key === key);

    // Skip non-column properties (relations, computed fields, etc.)
    // These are not subject to readonly validation
    if (!column) {
      continue;
    }

    // Only throw if trying to modify a readonly column
    if (column.readonly) {
      throw new EntityMetadataError("Column is readonly", { debug: { key, entity } });
    }
  }
};
