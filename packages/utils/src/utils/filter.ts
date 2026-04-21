import type { DeepPartial } from "@lindorm/types";
import { matches } from "../internal/index.js";

export const filter = <T>(array: Array<T>, partial: DeepPartial<T>): Array<T> =>
  array.filter((item) => matches(item, partial));
