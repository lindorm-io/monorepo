import { Dict } from "@lindorm/types";
import { SelectOptions } from "../../types";
import { HandlerResult } from "../../types/private";
import { quotation } from "./quotation";

export const handleOrdering = <T extends Dict>(
  options: SelectOptions<T>,
): HandlerResult => {
  let text = "";
  const values: Array<any> = [];

  if (options.order) {
    text = " ORDER BY ";
    for (const [key, order] of Object.entries(options.order)) {
      text += quotation(key) + " " + order + ", ";
    }
    text = text.slice(0, -2);
  }

  return { text, values };
};
