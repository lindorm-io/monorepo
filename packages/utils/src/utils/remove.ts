import { DeepPartial, Dict } from "@lindorm/types";
import { matches } from "./private";

export const remove = <T extends Dict>(
  array: Array<T>,
  partial: DeepPartial<T>,
): Array<T> => array.filter((item) => !matches(item, partial));
