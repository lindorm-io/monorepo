import { DeepPartial } from "@lindorm/types";
import { filter } from "./filter";

export const findLast = <T>(array: Array<T>, predicate: DeepPartial<T>): T | undefined =>
  filter(array, predicate).pop();
