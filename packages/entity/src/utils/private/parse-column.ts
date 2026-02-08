import { deserialise } from "@lindorm/json-kit";
import { DeepPartial } from "@lindorm/types";
import { EntityKitError } from "../../errors";
import { IEntity } from "../../interfaces";
import { MetaColumn } from "../../types";

type Column = Omit<MetaColumn, "target">;

export const parseColumn = <E extends IEntity, O extends DeepPartial<E> = DeepPartial<E>>(
  column: Column,
  entity: E,
  options: O = {} as O,
): any => {
  const value = (options as any)[column.key] ?? (entity as any)[column.key];

  if (value === null || value === undefined) {
    if (column.nullable || column.optional) return value;
    if (column.fallback !== null) {
      return typeof column.fallback === "function" ? column.fallback() : column.fallback;
    }
  }

  try {
    return deserialise(value, column.type);
  } catch (error) {
    throw new EntityKitError(
      `Failed to parse column "${column.key}" of type ${column.type}`,
      {
        debug: { column: column.key, value, type: typeof value, error },
      },
    );
  }
};
