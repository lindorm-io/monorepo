import { isArray, isObject, isString } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { SelectOptions } from "../../types";
import { HandlerResult } from "../../types/private";
import { quotation } from "./quotation";

export const handleSelectColumns = <T extends Dict>(
  options: SelectOptions<T> = {},
): HandlerResult => {
  let text = "";
  const values: Array<any> = [];

  if (options.aggregate) {
    text = `${options.aggregate.function}(${quotation(options.aggregate.column as string)})`;
  } else if (options.columns) {
    if (isArray(options.columns)) {
      text = options.columns.map((col) => quotation(col as string)).join(", ");
    } else if (isObject(options.columns)) {
      text = Object.entries(options.columns)
        .map(([col, alias]) => {
          if (alias === true || alias === 1) {
            return quotation(col);
          } else if (isString(alias)) {
            return `${quotation(col)} AS ${quotation(alias as string)}`;
          } else {
            throw new TypeError(
              "Columns must be an array of strings or an object with string (alias) | true | 1 values",
            );
          }
        })
        .join(", ");
    }
  } else {
    text = "*";
  }

  return { text, values };
};
