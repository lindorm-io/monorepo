import { isAfter, isBefore } from "@lindorm/date";
import {
  isArray,
  isBoolean,
  isDate,
  isEqual,
  isNumber,
  isObject,
  isRegExp,
  isString,
  isUndefined,
} from "@lindorm/is";
import type { Dict, Predicate, PredicateOperator } from "@lindorm/types";

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
];

const LOGICAL_OPERATORS = ["$and", "$or", "$not"];

const hasPredicateOperator = (predicate: Dict): boolean =>
  PREDICATE_OPERATORS.some((operator) => operator in predicate);

const hasLogicalOperator = (predicate: Dict): boolean =>
  LOGICAL_OPERATORS.some((operator) => operator in predicate);

const likeToRegex = (pattern: string, caseInsensitive: boolean): RegExp => {
  let regexStr = "";
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === "%") regexStr += ".*";
    else if (char === "_") regexStr += ".";
    else if (/[\\^$.|?*+()[\]{}]/.test(char)) regexStr += `\\${char}`;
    else regexStr += char;
  }
  return new RegExp(`^${regexStr}$`, caseInsensitive ? "i" : "");
};

// Every operator PRESENT in the object must hold — an operator object with more
// than one operator (e.g. `{ $gt: 5, $lt: 10 }`) is a CONJUNCTION, matching how
// the SQL compilers AND their per-operator clauses. Short-circuits on the first
// failing operator; throws if the object carries no recognised operator, or a
// recognised one that in-memory matching cannot evaluate (`$similar`).
const matchPredicateOperator = <T>(value: T, operator: PredicateOperator<T>): boolean => {
  // `$similar` is PostgreSQL pg_trgm trigram search — it compiles to a
  // driver-specific query and has no in-memory equivalent, so surface it as a
  // clear error (mirroring the non-Postgres SQL dialects) rather than silently
  // never matching.
  if (!isUndefined(operator.$similar)) {
    throw new TypeError(
      "Operator $similar (PostgreSQL trigram search) cannot be evaluated for in-memory matching",
    );
  }

  let matched = false;

  if (isBoolean(operator.$exists)) {
    matched = true;
    if (operator.$exists ? value == null : value != null) return false;
  }

  if (!isUndefined(operator.$eq)) {
    matched = true;
    if (!isEqual(value, operator.$eq)) return false;
  }

  if (!isUndefined(operator.$neq)) {
    matched = true;
    if (isEqual(value, operator.$neq)) return false;
  }

  if (!isUndefined(operator.$gt)) {
    matched = true;
    if (isDate(value) && isDate(operator.$gt)) {
      if (!isAfter(value, operator.$gt)) return false;
    } else if (isNumber(value) && isNumber(operator.$gt)) {
      if (value <= operator.$gt) return false;
    } else {
      throw new TypeError(
        `Operator $gt is not supported for value type [ ${typeof value} ]`,
      );
    }
  }

  if (!isUndefined(operator.$gte)) {
    matched = true;
    if (isDate(value) && isDate(operator.$gte)) {
      if (!(isAfter(value, operator.$gte) || isEqual(value, operator.$gte))) return false;
    } else if (isNumber(value) && isNumber(operator.$gte)) {
      if (value < operator.$gte) return false;
    } else {
      throw new TypeError(
        `Operator $gte is not supported for value type [ ${typeof value} ]`,
      );
    }
  }

  if (!isUndefined(operator.$lt)) {
    matched = true;
    if (isDate(value) && isDate(operator.$lt)) {
      if (!isBefore(value, operator.$lt)) return false;
    } else if (isNumber(value) && isNumber(operator.$lt)) {
      if (value >= operator.$lt) return false;
    } else {
      throw new TypeError(
        `Operator $lt is not supported for value type [ ${typeof value} ]`,
      );
    }
  }

  if (!isUndefined(operator.$lte)) {
    matched = true;
    if (isDate(value) && isDate(operator.$lte)) {
      if (!(isBefore(value, operator.$lte) || isEqual(value, operator.$lte)))
        return false;
    } else if (isNumber(value) && isNumber(operator.$lte)) {
      if (value > operator.$lte) return false;
    } else {
      throw new TypeError(
        `Operator $lte is not supported for value type [ ${typeof value} ]`,
      );
    }
  }

  if (!isUndefined(operator.$between)) {
    matched = true;
    const [low, high] = operator.$between;
    if (isDate(value) && isDate(low) && isDate(high)) {
      const inRange =
        (isAfter(value, low) || isEqual(value, low)) &&
        (isBefore(value, high) || isEqual(value, high));
      if (!inRange) return false;
    } else if (isNumber(value) && isNumber(low) && isNumber(high)) {
      if (value < low || value > high) return false;
    } else {
      throw new TypeError(
        `Operator $between is not supported for value type [ ${typeof value} ]`,
      );
    }
  }

  if (!isUndefined(operator.$like)) {
    matched = true;
    if (
      !isString(value) ||
      !isString(operator.$like) ||
      !likeToRegex(operator.$like, false).test(value)
    ) {
      return false;
    }
  }

  if (!isUndefined(operator.$ilike)) {
    matched = true;
    if (
      !isString(value) ||
      !isString(operator.$ilike) ||
      !likeToRegex(operator.$ilike, true).test(value)
    ) {
      return false;
    }
  }

  if (isRegExp(operator.$regex)) {
    matched = true;
    if (!isString(value) || !new RegExp(operator.$regex).test(value)) return false;
  }

  // `$in`/`$nin` are typed `Array<NonNullable<T>>` — a value set never usefully
  // contains null/undefined, and stripping them is what lets a UNION-typed field
  // take a mixed array. `includes` is a runtime membership test, so a nullable
  // `value` is safe here (it simply does not match); only the signature narrows.
  if (isArray(operator.$in)) {
    matched = true;
    const ok = isArray<any>(value)
      ? value.some((v) => operator.$in!.includes(v))
      : operator.$in.includes(value as NonNullable<T>);
    if (!ok) return false;
  }

  if (isArray(operator.$nin)) {
    matched = true;
    const ok = isArray<any>(value)
      ? value.every((v) => !operator.$nin!.includes(v))
      : !operator.$nin.includes(value as NonNullable<T>);
    if (!ok) return false;
  }

  if (isArray(operator.$all)) {
    matched = true;
    if (!isArray<any>(value) || !operator.$all.every((v) => value.includes(v))) {
      return false;
    }
  }

  if (isArray(operator.$overlap)) {
    matched = true;
    if (!isArray<any>(value) || !operator.$overlap.some((v) => value.includes(v))) {
      return false;
    }
  }

  if (isArray(operator.$contained)) {
    matched = true;
    if (
      !isArray<any>(value) ||
      !value.every((v: any) => operator.$contained!.includes(v))
    ) {
      return false;
    }
  }

  if (isNumber(operator.$length)) {
    matched = true;
    if (value == null) return false;
    else if (isArray(value) || isString(value)) {
      if (value.length !== operator.$length) return false;
    } else if (isObject(value)) {
      if (Object.keys(value).length !== operator.$length) return false;
    } else {
      throw new TypeError(
        `Operator $length is not supported for value type [ ${typeof value} ]`,
      );
    }
  }

  if (isArray(operator.$mod) && operator.$mod.length === 2) {
    matched = true;
    if (!isNumber(value)) {
      throw new TypeError(
        `Operator $mod is not supported for value type [ ${typeof value} ]`,
      );
    }
    const [divisor, remainder] = operator.$mod;
    if (!isNumber(divisor) || !isNumber(remainder)) {
      throw new TypeError(
        `Operator $mod requires both divisor and remainder to be numbers, got [ ${typeof divisor}, ${typeof remainder} ]`,
      );
    }
    if (divisor === 0) {
      throw new Error("Division by zero is not allowed in $mod operator");
    }
    if (value % divisor !== remainder) return false;
  }

  if (!isUndefined(operator.$has)) {
    matched = true;
    const ok = isArray(value)
      ? (value as Array<unknown>).some(
          (v) => isObject(v) && advancedMatch(v, operator.$has as Predicate<any>),
        )
      : isObject(value)
        ? advancedMatch(value as Dict, operator.$has as Predicate<any>)
        : false;
    if (!ok) return false;
  }

  if (!matched) {
    throw new TypeError(`Unknown operator in predicate: ${JSON.stringify(operator)}`);
  }

  return true;
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
