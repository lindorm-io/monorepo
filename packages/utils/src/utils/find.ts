import { DeepPartial } from "@lindorm/types";
import { matches } from "../internal/index";

export const find = <T>(array: Array<T>, partial: DeepPartial<T>): T | undefined =>
  array.find((item) => matches(item, partial));
