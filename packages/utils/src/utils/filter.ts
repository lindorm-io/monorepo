import { DeepPartial } from "@lindorm/types";
import { matches } from "#internal/index";

export const filter = <T>(array: Array<T>, partial: DeepPartial<T>): Array<T> =>
  array.filter((item) => matches(item, partial));
