import type { DeepPartial, Dict } from "@lindorm/types";

/**
 * The value types the range operators can order: `number | Date | bigint |
 * string`. Strings order by PLAIN JS comparison — the language does not attempt
 * to reproduce a database's collation, so a mixed-case or non-ASCII string range
 * is a DOCUMENTED cross-driver divergence, the same class as `$regex`.
 *
 * Intersecting it with the field type is what makes the restriction visible at
 * compile time: a `boolean`, a `Buffer` or a plain object is assignable to
 * neither side, so `{ published: { $gt: true } }` no longer waits until runtime
 * to fail. A `null` operand fails here too — `$gte: null` is not orderable.
 */
type Comparable = number | bigint | string | Date;

export type ConditionOperator<T> = {
  // existence
  $exists?: boolean;
  $eq?: T | null;
  $neq?: T | null;

  // comparisons
  $gt?: T & Comparable;
  $gte?: T & Comparable;
  $lt?: T & Comparable;
  $lte?: T & Comparable;
  $between?: [T & Comparable, T & Comparable];

  // fuzzy finding
  $like?: T;
  $ilike?: T;
  $regex?: RegExp;
  $similar?: string | { value: string; threshold: number };

  // arrays
  //
  // `[NonNullable<T>] extends [Array<...>]` — both halves are load-bearing.
  //
  // The TUPLE WRAP defeats distribution. A naked type parameter in a
  // conditional type distributes over a union, so a field typed as a union of
  // literals (`algorithm: "ES256" | "EdDSA" | ...`) resolved `$in` to
  // `Array<"ES256"> | Array<"EdDSA"> | ...` — a union of HOMOGENEOUS arrays,
  // which made the one thing `$in` exists for (a mixed value set) a type error.
  //
  // NonNullable then restores what distribution used to do incidentally: an
  // OPTIONAL array field arrives here as `Array<string> | undefined`, and a
  // bare tuple wrap would fail the `Array` test on the `undefined` member and
  // hand back `Array<Array<string> | undefined>`. Stripping null/undefined
  // first keeps such fields unwrapping to their element type.
  $in?: [NonNullable<T>] extends [Array<infer U>] ? Array<U> : Array<NonNullable<T>>;
  $nin?: [NonNullable<T>] extends [Array<infer U>] ? Array<U> : Array<NonNullable<T>>;
  $all?: [NonNullable<T>] extends [Array<infer U>] ? Array<U> : Array<NonNullable<T>>;
  $overlap?: [NonNullable<T>] extends [Array<infer U>] ? Array<U> : Array<NonNullable<T>>;
  $contained?: [NonNullable<T>] extends [Array<infer U>]
    ? Array<U>
    : Array<NonNullable<T>>;
  $length?: number;

  // json/object containment
  //
  // Plain JSON containment, the same thing every dialect's `compileHas` emits —
  // no nested operators. Against an ARRAY the operand may be a single ELEMENT
  // (`{ tags: { $has: "a" } }`) as well as a list of them, which is why the
  // element type is unwrapped and offered alongside the whole shape.
  $has?: [NonNullable<T>] extends [Array<infer U>]
    ? DeepPartial<T> | DeepPartial<U>
    : DeepPartial<T>;

  // numbers
  $mod?: [number, number]; // value % [0] === [1]

  // logical
  $and?: Array<
    T | null | ConditionOperator<DeepPartial<T>> | RootCondition<DeepPartial<T>>
  >;
  $or?: Array<
    T | null | ConditionOperator<DeepPartial<T>> | RootCondition<DeepPartial<T>>
  >;
  $not?: ConditionOperator<DeepPartial<T>> | RootCondition<DeepPartial<T>>;
};

export type RootCondition<T extends Dict> = {
  [K in keyof T]?:
    | T[K]
    | DeepPartial<T[K]>
    | ConditionOperator<DeepPartial<T[K]>>
    | RootCondition<DeepPartial<T[K]>>;
};

export type Condition<T extends Dict> = {
  $and?: Array<Condition<DeepPartial<T>>>;
  $or?: Array<Condition<DeepPartial<T>>>;
  $not?: Condition<DeepPartial<T>>;
} & RootCondition<T>;
