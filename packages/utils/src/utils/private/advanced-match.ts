import { isAfter, isBefore } from "@lindorm/date";
import {
  isArray,
  isBoolean,
  isDate,
  isEqual,
  isNumber,
  isObject,
  isString,
  isUndefined,
} from "@lindorm/is";
import { Dict, Predicate, PredicateOperator } from "@lindorm/types";
import { isRegExp } from "util/types";

const PREDICATE_OPERATORS = [
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

  // arrays
  "$in",
  "$nin",
  "$all",
  "$length",

  // numbers
  "$mod",
];

const LOGICAL_OPERATORS = ["$and", "$or", "$not"];

const hasPredicateOperator = (predicate: Dict): boolean =>
  PREDICATE_OPERATORS.some((operator) => operator in predicate);

const hasLogicalOperator = (predicate: Dict): boolean =>
  LOGICAL_OPERATORS.some((operator) => operator in predicate);

const matchPredicateOperator = <T>(value: T, operator: PredicateOperator<T>): boolean => {
  if (isBoolean(operator.$exists)) {
    return operator.$exists ? !isUndefined(value) : isUndefined(value);
  }

  if (!isUndefined(operator.$eq)) {
    return isEqual(value, operator.$eq);
  }

  if (!isUndefined(operator.$neq)) {
    return !isEqual(value, operator.$neq);
  }

  if (!isUndefined(operator.$gt)) {
    if (isDate(value) && isDate(operator.$gt)) return isAfter(value, operator.$gt);
    if (isNumber(value) && isNumber(operator.$gt)) return value > operator.$gt;
    throw new TypeError(
      `Operator $gt is not supported for value type [ ${typeof value} ]`,
    );
  }

  if (!isUndefined(operator.$gte)) {
    if (isDate(value) && isDate(operator.$gte))
      return isAfter(value, operator.$gte) || isEqual(value, operator.$gte);
    if (isNumber(value) && isNumber(operator.$gte)) return value >= operator.$gte;
    throw new TypeError(
      `Operator $gte is not supported for value type [ ${typeof value} ]`,
    );
  }

  if (!isUndefined(operator.$lt)) {
    if (isDate(value) && isDate(operator.$lt)) return isBefore(value, operator.$lt);
    if (isNumber(value) && isNumber(operator.$lt)) return value < operator.$lt;
    throw new TypeError(
      `Operator $lt is not supported for value type [ ${typeof value} ]`,
    );
  }

  if (!isUndefined(operator.$lte)) {
    if (isDate(value) && isDate(operator.$lte))
      return isBefore(value, operator.$lte) || isEqual(value, operator.$lte);
    if (isNumber(value) && isNumber(operator.$lte)) return value <= operator.$lte;
    throw new TypeError(
      `Operator $lte is not supported for value type [ ${typeof value} ]`,
    );
  }

  if (!isUndefined(operator.$between)) {
    if (isDate(value) && isDate(operator.$between[0]) && isDate(operator.$between[1])) {
      return (
        (isAfter(value, operator.$between[0]) || isEqual(value, operator.$between[0])) &&
        (isBefore(value, operator.$between[1]) || isEqual(value, operator.$between[1]))
      );
    }

    if (
      isNumber(value) &&
      isNumber(operator.$between[0]) &&
      isNumber(operator.$between[1])
    ) {
      return value >= operator.$between[0] && value <= operator.$between[1];
    }

    throw new TypeError(
      `Operator $between is not supported for value type [ ${typeof value} ]`,
    );
  }

  if (!isUndefined(operator.$like) && isString(value) && isString(operator.$like)) {
    return value.includes(operator.$like);
  }

  if (!isUndefined(operator.$ilike) && isString(value) && isString(operator.$ilike)) {
    return value.toLowerCase().includes(operator.$ilike.toLowerCase());
  }

  if (isRegExp(operator.$regex) && isString(value)) {
    const regex = new RegExp(operator.$regex);
    return regex.test(value);
  }

  if (isArray(operator.$in)) {
    return isArray<any>(value)
      ? value.some((v) => operator.$in!.includes(v))
      : operator.$in.includes(value);
  }

  if (isArray(operator.$nin)) {
    return isArray<any>(value)
      ? value.every((v) => !operator.$nin!.includes(v))
      : !operator.$nin.includes(value);
  }

  if (isArray(operator.$all)) {
    return isArray<any>(value) ? operator.$all.every((v) => value.includes(v)) : false;
  }

  if (isNumber(operator.$length)) {
    if (isArray(value)) {
      return value.length === operator.$length;
    }
    if (isString(value)) {
      return value.length === operator.$length;
    }
    if (isObject(value)) {
      return Object.keys(value).length === operator.$length;
    }
    throw new TypeError(
      `Operator $length is not supported for value type [ ${typeof value} ]`,
    );
  }

  if (isArray(operator.$mod) && operator.$mod.length === 2) {
    if (isNumber(value)) {
      const [divisor, remainder] = operator.$mod;
      if (!isNumber(divisor) || !isNumber(remainder)) {
        throw new TypeError(
          `Operator $mod requires both divisor and remainder to be numbers, got [ ${typeof divisor}, ${typeof remainder} ]`,
        );
      }
      if (divisor === 0) {
        throw new Error("Division by zero is not allowed in $mod operator");
      }
      return value % divisor === remainder;
    }
    throw new TypeError(
      `Operator $mod is not supported for value type [ ${typeof value} ]`,
    );
  }

  throw new TypeError(`Unknown operator in predicate: ${JSON.stringify(operator)}`);
};

const handleLogicalOperators = <T>(
  objectValue: any,
  predicate: PredicateOperator<T>,
  matchesFn: any,
): boolean => {
  if (predicate.$and) {
    return predicate.$and.every((subPredicate) => {
      if (isObject(subPredicate)) {
        if (hasPredicateOperator(subPredicate as PredicateOperator<any>)) {
          return matchPredicateOperator(
            objectValue,
            subPredicate as PredicateOperator<any>,
          );
        } else {
          return matchesFn(objectValue, subPredicate as any);
        }
      } else {
        return objectValue === subPredicate;
      }
    });
  }

  if (predicate.$or) {
    return predicate.$or.some((subPredicate) => {
      if (isObject(subPredicate)) {
        if (hasPredicateOperator(subPredicate as PredicateOperator<any>)) {
          return matchPredicateOperator(
            objectValue,
            subPredicate as PredicateOperator<any>,
          );
        } else {
          return matchesFn(objectValue, subPredicate as any);
        }
      } else {
        return objectValue === subPredicate;
      }
    });
  }

  if (predicate.$not) {
    if (isObject(predicate.$not)) {
      if (hasPredicateOperator(predicate.$not)) {
        return !matchPredicateOperator(
          objectValue,
          predicate.$not as PredicateOperator<any>,
        );
      } else {
        return !matchesFn(objectValue, predicate.$not);
      }
    }
    return objectValue !== predicate.$not;
  }

  return false;
};

export const advancedMatch = <T extends Dict>(
  object: T,
  predicate: Predicate<T>,
): boolean =>
  Object.entries(predicate).every(([key, predicateValue]) => {
    // Handle logical operators if present
    if (LOGICAL_OPERATORS.includes(key)) {
      return handleLogicalOperators(
        object,
        { [key]: predicateValue } as PredicateOperator<any>,
        advancedMatch,
      );
    }

    const objectValue = object[key as keyof T];

    // Handle field-level predicates
    if (isArray(predicateValue)) {
      if (!isArray(objectValue)) return false;

      return predicateValue.every((pv) =>
        objectValue.some((ov: any) => (isObject(pv) ? advancedMatch(ov, pv) : pv === ov)),
      );
    }

    if (isObject(predicateValue)) {
      if (hasLogicalOperator(predicateValue)) {
        return handleLogicalOperators(
          objectValue,
          predicateValue as PredicateOperator<any>,
          advancedMatch,
        );
      }

      if (hasPredicateOperator(predicateValue as PredicateOperator<any>)) {
        return matchPredicateOperator(
          objectValue,
          predicateValue as PredicateOperator<any>,
        );
      }

      if (isObject(objectValue)) {
        return advancedMatch(objectValue, predicateValue as Predicate<any>);
      }
    }

    if (isUndefined(predicateValue)) return true;
    if (isUndefined(objectValue)) return false;

    return predicateValue === objectValue;
  });
