/**
 * The operator vocabulary, in one place. `matchValueKey` dispatches on these:
 * a `$`-prefixed key that is in neither list is a MALFORMED condition and
 * throws — silence is what let `$ne`/`$isNull` style misspellings match
 * everything on one driver and nothing on another.
 */
export const CONDITION_OPERATORS = [
  // existence
  "$exists",
  "$eq",
  "$neq",

  // comparisons
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$between",

  // fuzzy finding
  "$like",
  "$ilike",
  "$regex",
  "$similar",

  // arrays
  "$in",
  "$nin",
  "$all",
  "$overlap",
  "$contained",
  "$length",

  // json/object containment
  "$has",

  // numbers
  "$mod",
] as const;

export type ConditionOperatorKey = (typeof CONDITION_OPERATORS)[number];

export const LOGICAL_OPERATORS = ["$and", "$or", "$not"] as const;

export type LogicalOperatorKey = (typeof LOGICAL_OPERATORS)[number];

export const isConditionOperatorKey = (key: string): key is ConditionOperatorKey =>
  (CONDITION_OPERATORS as ReadonlyArray<string>).includes(key);

export const isLogicalOperatorKey = (key: string): key is LogicalOperatorKey =>
  (LOGICAL_OPERATORS as ReadonlyArray<string>).includes(key);
