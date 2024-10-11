import { Dict } from "@lindorm/types";
import { Predicate } from "../types";
import { advancedMatch } from "../utils/private";

export class Predicated {
  public static filter<T extends Dict>(
    array: Array<T>,
    predicate: Predicate<T>,
  ): Array<T> {
    return array.filter((item) => advancedMatch(item, predicate));
  }

  public static find<T extends Dict>(
    array: Array<T>,
    predicate: Predicate<T>,
  ): T | undefined {
    return array.find((item) => advancedMatch(item, predicate));
  }

  public static findLast<T extends Dict>(
    array: Array<T>,
    predicate: Predicate<T>,
  ): T | undefined {
    return array.filter((item) => advancedMatch(item, predicate)).pop();
  }

  public static match<T extends Dict>(record: T, predicate: Predicate<T>): boolean {
    return advancedMatch(record, predicate);
  }

  public static remove<T extends Dict>(
    array: Array<T>,
    predicate: Predicate<T>,
  ): Array<T> {
    return array.filter((item) => advancedMatch(item, { $not: predicate }));
  }
}
