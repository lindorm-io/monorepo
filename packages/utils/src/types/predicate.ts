import { DeepPartial, Dict } from "@lindorm/types";

export type PredicateOperator<T> = {
  $eq?: T | null;
  $neq?: T | null;
  $gt?: T;
  $gte?: T;
  $lt?: T;
  $lte?: T;
  $like?: T;
  $ilike?: T;
  $in?: T extends Array<infer U> ? Array<U> : Array<T>;
  $nin?: T extends Array<infer U> ? Array<U> : Array<T>;
  $between?: [T, T];
  $regex?: RegExp;

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
