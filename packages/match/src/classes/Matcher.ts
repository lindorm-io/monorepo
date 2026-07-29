import type { Dict } from "@lindorm/types";
import type { Condition } from "../types/condition.js";
import { matches } from "../utils/matches.js";

export class Matcher {
  static filter<T extends Dict>(array: Array<T>, condition: Condition<T>): Array<T> {
    return array.filter((item) => matches(item, condition));
  }

  static find<T extends Dict>(array: Array<T>, condition: Condition<T>): T | undefined {
    return array.find((item) => matches(item, condition));
  }

  static findLast<T extends Dict>(
    array: Array<T>,
    condition: Condition<T>,
  ): T | undefined {
    return array.filter((item) => matches(item, condition)).pop();
  }

  static match<T extends Dict>(record: T, condition: Condition<T>): boolean {
    return matches(record, condition);
  }

  static remove<T extends Dict>(array: Array<T>, condition: Condition<T>): Array<T> {
    return array.filter((item) => matches(item, { $not: condition }));
  }
}
