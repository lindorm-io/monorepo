import { isArray, isNumber, isObject, isString } from "@lindorm/is";
import { Dict, Predicate, PredicateOperator } from "@lindorm/types";
import { ValidateJwtOptions } from "../../types";
import { createAccessTokenHash, createCodeHash, createStateHash } from "./create-hash";

export const createJwtValidate = (validate: ValidateJwtOptions): Predicate<Dict> => {
  const algorithm = validate.algorithm;
  const predicate: Predicate<Dict> = {};

  for (const [key, value] of Object.entries(validate)) {
    if (key === "algorithm") continue;

    if (key === "accessToken" && algorithm && isString(value)) {
      predicate[key] = { $eq: createAccessTokenHash(algorithm, value) };
      continue;
    }
    if (key === "authCode" && algorithm && isString(value)) {
      predicate[key] = { $eq: createCodeHash(algorithm, value) };
      continue;
    }
    if (key === "authState" && algorithm && isString(value)) {
      predicate[key] = { $eq: createStateHash(algorithm, value) };
      continue;
    }
    if (isArray<string>(value)) {
      predicate[key] = { $all: value };
      continue;
    }
    if (isNumber(value)) {
      predicate[key] = { $eq: value };
      continue;
    }
    if (isString(value)) {
      predicate[key] = { $eq: value };
      continue;
    }
    if (isObject(value)) {
      predicate[key] = value as PredicateOperator<any>;
      continue;
    }

    throw new Error(`Unsupported value: ${value as any} for key: ${key}`);
  }

  return predicate;
};
