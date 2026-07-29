import type { DeepPartial, Dict } from "@lindorm/types";

export type ConditionOperator<T> = {
  // existence
  $exists?: boolean;
  $eq?: T | null;
  $neq?: T | null;

  // comparisons
  $gt?: T;
  $gte?: T;
  $lt?: T;
  $lte?: T;
  $between?: [T, T];

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
  $has?: DeepPartial<T>;

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
