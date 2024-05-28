import { DeepPartial } from "@lindorm/types";
import { matches } from "./private";

export const filter = <T>(array: Array<T>, predicate: DeepPartial<T>): Array<T> =>
  array.filter((item) => matches(item, predicate));
