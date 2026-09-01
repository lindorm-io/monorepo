import type { Dict } from "@lindorm/types";

export type ChangeCase =
  | "camel"
  | "capital"
  | "constant"
  | "dot"
  | "header"
  | "kebab"
  | "lower"
  | "pascal"
  | "path"
  | "sentence"
  | "snake"
  | "none";

export type CaseCallback = (input: string) => string;

export type KeysInput = Dict | Array<Dict>;

export type KeysOptions = {
  /**
   * How many object-key LEVELS to convert. Level 1 is the input object's own
   * keys.
   *
   * Arrays are transparent containers — they carry no keys of their own, so
   * entering one does NOT consume a level. Recursing into an object VALUE does.
   * `{ a: [{ b: 1 }] }` at depth 1 therefore converts `a` and leaves `b`
   * verbatim; a subtree beyond the depth is kept by reference, untouched.
   *
   * Omitted means unlimited. Must be an integer >= 1 (or `Infinity`) — `0` and
   * below throw rather than silently converting nothing, since `changeKeys`
   * already spells that as mode `"none"`.
   */
  depth?: number;
  /**
   * Keys to keep verbatim. A key for which this returns `true` is kept as it is,
   * together with its VALUE, by reference — exactly like a subtree beyond
   * `depth`. It is checked before descent and spends no depth, at every level
   * and inside arrays.
   *
   * Omitted means every key is converted. `isVerbatimKey` exempts a key
   * holding a character outside letters, digits and `_`.
   */
  exempt?: (key: string) => boolean;
};
