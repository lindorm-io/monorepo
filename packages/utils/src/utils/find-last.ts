import type { DeepPartial } from "@lindorm/types";
import { matches } from "../internal/index.js";

export const findLast = <T>(array: Array<T>, partial: DeepPartial<T>): T | undefined =>
  array.filter((item) => matches(item, partial)).pop();
