import { isNumber, isObjectLike } from "@lindorm/is";
import { ProteusError } from "../../errors/index.js";

export const extractEnumValues = (
  enumDef: Record<string, string | number>,
): Array<string> => {
  if (!isObjectLike(enumDef) || enumDef === null) {
    throw new ProteusError("Enum definition must be a TypeScript enum object");
  }
  const values = new Set<string>();
  for (const key of Object.keys(enumDef)) {
    if (!isNaN(Number(key))) continue;
    const value = enumDef[key];
    values.add(isNumber(value) ? key : String(value));
  }
  return Array.from(values);
};
