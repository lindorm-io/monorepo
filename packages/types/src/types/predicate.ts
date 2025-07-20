import { DeepPartial, Dict } from "./types";

export type PredicateOperator<T> = {
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

  // arrays
  $in?: T extends Array<infer U> ? Array<U> : Array<T>;
  $nin?: T extends Array<infer U> ? Array<U> : Array<T>;
  $all?: T extends Array<infer U> ? Array<U> : Array<T>;
  $length?: number;

  // numbers
  $mod?: [number, number]; // value % [0] === [1]

  // logical
  $and?: Array<
    T | null | PredicateOperator<DeepPartial<T>> | RootPredicate<DeepPartial<T>>
  >;
  $or?: Array<
    T | null | PredicateOperator<DeepPartial<T>> | RootPredicate<DeepPartial<T>>
  >;
  $not?: PredicateOperator<DeepPartial<T>> | RootPredicate<DeepPartial<T>>;
};

export type RootPredicate<T extends Dict> = {
  [K in keyof T]?:
    | T[K]
    | DeepPartial<T[K]>
    | PredicateOperator<DeepPartial<T[K]>>
    | RootPredicate<DeepPartial<T[K]>>;
};

export type Predicate<T extends Dict> = {
  $and?: Array<Predicate<DeepPartial<T>>>;
  $or?: Array<Predicate<DeepPartial<T>>>;
  $not?: Predicate<DeepPartial<T>>;
} & RootPredicate<T>;
