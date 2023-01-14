import { MetaType } from "../enum";

export const getMetaType = (value: any): string => {
  if (Array.isArray(value)) return MetaType.ARRAY;
  if (typeof value === "boolean") return MetaType.BOOLEAN;
  if (value instanceof Date) return MetaType.DATE;
  if (value instanceof Error) return MetaType.ERROR;
  if (value === null) return MetaType.NULL;
  if (typeof value === "number") return MetaType.NUMBER;
  if (typeof value === "string") return MetaType.STRING;
  if (value === undefined) return MetaType.UNDEFINED;

  return MetaType.UNKNOWN;
};
