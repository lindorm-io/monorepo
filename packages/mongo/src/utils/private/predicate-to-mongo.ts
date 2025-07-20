import { Dict, Predicate, PredicateOperator } from "@lindorm/types";
import { Filter } from "mongodb";

const hasPredicateOperator = (obj: Record<string, any>): boolean => {
  return Object.keys(obj).some((key) =>
    [
      "$eq",
      "$neq",
      "$gt",
      "$gte",
      "$lt",
      "$lte",
      "$in",
      "$nin",
      "$all",
      "$mod",
      "$exists",
      "$like",
      "$ilike",
      "$regex",
      "$between",
      "$length",
      "$and",
      "$or",
      "$not",
    ].includes(key),
  );
};

const convertPredicateValue = (value: any): any => {
  if (typeof value === "object" && value !== null) {
    if (hasPredicateOperator(value)) {
      return convertPredicateOperator(value);
    }
    return predicateToMongo(value);
  }

  return { $eq: value };
};

const convertPredicateOperator = (
  operator: PredicateOperator<any>,
): Record<string, any> => {
  const mongo: Record<string, any> = {};

  if (operator.$exists !== undefined) mongo.$exists = operator.$exists;
  if (operator.$eq !== undefined) mongo.$eq = operator.$eq;
  if (operator.$neq !== undefined) mongo.$ne = operator.$neq;
  if (operator.$gt !== undefined) mongo.$gt = operator.$gt;
  if (operator.$gte !== undefined) mongo.$gte = operator.$gte;
  if (operator.$lt !== undefined) mongo.$lt = operator.$lt;
  if (operator.$lte !== undefined) mongo.$lte = operator.$lte;
  if (operator.$in !== undefined) mongo.$in = operator.$in;
  if (operator.$nin !== undefined) mongo.$nin = operator.$nin;
  if (operator.$all !== undefined) mongo.$all = operator.$all;
  if (operator.$mod !== undefined) mongo.$mod = operator.$mod;

  if (operator.$between) {
    mongo.$gte = operator.$between[0];
    mongo.$lte = operator.$between[1];
  }

  if (operator.$like) {
    mongo.$regex = new RegExp(operator.$like, "");
  }

  if (operator.$ilike) {
    mongo.$regex = new RegExp(operator.$ilike, "i");
  }

  if (operator.$regex) {
    mongo.$regex = operator.$regex;
  }

  if (operator.$length !== undefined) {
    mongo.$size = operator.$length;
  }

  if (operator.$and) {
    mongo.$and = operator.$and.map(convertPredicateValue);
  }

  if (operator.$or) {
    mongo.$or = operator.$or.map(convertPredicateValue);
  }

  if (operator.$not) {
    mongo.$not = convertPredicateValue(operator.$not);
  }

  return mongo;
};

export const predicateToMongo = <T extends Dict>(predicate: Predicate<T>): Filter<T> => {
  const convert = (input: any): any => {
    if (Array.isArray(input)) {
      return input.map(convert);
    }

    if (typeof input !== "object" || input === null) {
      return input;
    }

    // Handle logical root operators
    if ("$and" in input || "$or" in input || "$not" in input) {
      const result: Record<string, any> = {};
      if (input.$and) result.$and = input.$and.map(convert);
      if (input.$or) result.$or = input.$or.map(convert);
      if (input.$not) result.$not = convert(input.$not);
      return result;
    }

    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(input)) {
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        if (hasPredicateOperator(value)) {
          result[key] = convertPredicateOperator(value);
        } else {
          result[key] = convert(value);
        }
      } else {
        result[key] = value;
      }
    }

    return result;
  };

  return convert(predicate);
};
