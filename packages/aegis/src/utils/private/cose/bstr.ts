import { isBuffer, isString } from "@lindorm/is";
import { CoseItem } from "../../../constants/private";

export const toBstr = (item: CoseItem, value: any): any =>
  item.bstr ? (isBuffer(value) ? value : Buffer.from(value.toString())) : value;

export const fromBstr = (item: CoseItem, value: any): any => {
  const result = item.bstr ? value.toString("utf8") : value;

  if (!isString(result)) return result;

  if (item.array) return result.split(",").map((i: string) => i.trim());
  if (item.json) return JSON.parse(result);

  return result;
};
