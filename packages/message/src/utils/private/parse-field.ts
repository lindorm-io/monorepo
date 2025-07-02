import { DeepPartial } from "@lindorm/types";
import { IMessage } from "../../interfaces";
import { MetaField } from "../../types";

type Field = Omit<MetaField, "target">;

export const parseField = <E extends IMessage, O extends DeepPartial<E> = DeepPartial<E>>(
  field: Field,
  message: E,
  options: O = {} as O,
): any => {
  const value = (options as any)[field.key] ?? (message as any)[field.key];

  switch (field.type) {
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
