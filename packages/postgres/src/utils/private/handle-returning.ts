import { isArray } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { ReturningOptions } from "../../types";
import { HandlerResult } from "../../types/private";
import { quotation } from "./quotation";

export const handleReturning = <T extends Dict>(
  options: ReturningOptions<T> = {},
): HandlerResult => {
  if (!options.returning) return { text: "", values: [] };

  let text = " RETURNING ";

  if (isArray(options.returning)) {
    text += options.returning.map((col) => quotation(col as string)).join(", ");
  } else if (options.returning === true) {
    text += "*";
  }

  return { text, values: [] };
};
