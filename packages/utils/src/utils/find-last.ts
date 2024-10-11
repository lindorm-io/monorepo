import { DeepPartial } from "@lindorm/types";
import { matches } from "./private";

export const findLast = <T>(array: Array<T>, partial: DeepPartial<T>): T | undefined =>
  array.filter((item) => matches(item, partial)).pop();
