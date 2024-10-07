import { Dict } from "@lindorm/types";
import { SelectOptions } from "../../types";
import { HandlerResult } from "../../types/private";

export const handlePagination = <T extends Dict>(
  options: SelectOptions<T> = {},
): HandlerResult => {
  let text = "";
  const values: Array<any> = [];

  if (options.limit || options.pageSize) {
    text += " LIMIT ?";
    values.push(options.pageSize ?? options.limit);
  }

  if (options.offset || options.page) {
    text += " OFFSET ?";
    values.push(
      options.page ? (options.page - 1) * (options.pageSize ?? 10) : options.offset,
    );
  }

  return { text, values };
};
