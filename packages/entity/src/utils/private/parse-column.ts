import { DeepPartial } from "@lindorm/types";
import { IEntity } from "../../interfaces";
import { MetaColumn } from "../../types";

type Column = Omit<MetaColumn, "target">;

export const parseColumn = <E extends IEntity, O extends DeepPartial<E> = DeepPartial<E>>(
  column: Column,
  entity: E,
  options: O = {} as O,
): any => {
  const value = (options as any)[column.key] ?? (entity as any)[column.key];

  switch (column.type) {
    case "bigint":
      return value instanceof BigInt ? value : BigInt(value ?? 0);

    case "boolean":
      return typeof value === "boolean" ? value : Boolean(value);

    case "date":
      return value && value instanceof Date ? value : value ? new Date(value) : value;

    case "float":
      return typeof value === "number" ? value : parseFloat(value);

    case "integer":
      return typeof value === "number" ? value : parseInt(value, 10);

    default:
      return value;
  }
};
