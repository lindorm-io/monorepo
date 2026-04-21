import type { DeepPartial } from "@lindorm/types";
import { matches } from "../internal/index.js";

export const find = <T>(array: Array<T>, partial: DeepPartial<T>): T | undefined =>
  array.find((item) => matches(item, partial));
