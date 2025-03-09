import { Constructor, DeepPartial } from "@lindorm/types";
import { EntityMetadataError } from "../errors";
import { IEntity } from "../interfaces";
import { globalEntityMetadata } from "./global";

export const verifyReadonly = <E extends IEntity>(
  Entity: Constructor<E>,
  entity: DeepPartial<E>,
): void => {
  const metadata = globalEntityMetadata.get(Entity);

  for (const key of Object.keys(entity)) {
    const column = metadata.columns.find((c) => c.key === key);
    if (!column) {
      throw new EntityMetadataError("Column not found", { debug: { key, entity } });
    }
    if (column.readonly) {
      throw new EntityMetadataError("Column is readonly", { debug: { key, entity } });
    }
  }
};
