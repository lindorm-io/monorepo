import type { Dict, Predicate } from "@lindorm/types";
import { advancedMatch } from "../internal/index.js";

export class Predicated {
  static filter<T extends Dict>(array: Array<T>, predicate: Predicate<T>): Array<T> {
    return array.filter((item) => advancedMatch(item, predicate));
  }

  static find<T extends Dict>(array: Array<T>, predicate: Predicate<T>): T | undefined {
    return array.find((item) => advancedMatch(item, predicate));
  }

  static findLast<T extends Dict>(
    array: Array<T>,
    predicate: Predicate<T>,
  ): T | undefined {
    return array.filter((item) => advancedMatch(item, predicate)).pop();
  }

  static match<T extends Dict>(record: T, predicate: Predicate<T>): boolean {
    return advancedMatch(record, predicate);
  }

  static remove<T extends Dict>(array: Array<T>, predicate: Predicate<T>): Array<T> {
    return array.filter((item) => advancedMatch(item, { $not: predicate }));
  }
}
