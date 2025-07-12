import { Constructor, DeepPartial } from "@lindorm/types";
import { EntityMetadataError } from "../errors";
import { IEntity } from "../interfaces";
import { globalEntityMetadata } from "./global";

export const removeReadonly = <E extends IEntity>(
  target: Constructor<E>,
  entity: E,
): DeepPartial<E> => {
  const metadata = globalEntityMetadata.get(target);
  const result: DeepPartial<E> = {};

  for (const [key, value] of Object.entries(entity)) {
    const column = metadata.columns.find((c) => c.key === key);
    if (!column) {
      throw new EntityMetadataError("Column not found", { debug: { key } });
    }
    if (column.decorator !== "Column" || !column.readonly) {
      (result as any)[key] = value;
    }
  }

  return result;
};
