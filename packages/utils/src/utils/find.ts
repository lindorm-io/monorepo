import { DeepPartial } from "@lindorm/types";
import { matches } from "./private";

export const find = <T>(array: Array<T>, predicate: DeepPartial<T>): T | undefined =>
  array.find((item) => matches(item, predicate));
