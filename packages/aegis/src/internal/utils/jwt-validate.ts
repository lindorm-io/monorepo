import type { Condition, ConditionOperator } from "@lindorm/match";
import { isArray, isNumber, isObject, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { AegisDomainError } from "../../errors/index.js";
import type { ValidateJwtOptions } from "../../types/index.js";
import { createAccessTokenHash, createCodeHash, createStateHash } from "./create-hash.js";

export const createJwtValidate = (validate: ValidateJwtOptions): Condition<Dict> => {
  const algorithm = validate.algorithm;
  const predicate: Condition<Dict> = {};

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
      predicate[key] = value as ConditionOperator<any>;
      continue;
    }

    throw new AegisDomainError(`Unsupported value: ${value as any} for key: ${key}`, {
      code: "jwt_validate_unsupported_value",
      data: { key },
      title: "JWT Validate Unsupported Value",
      details:
        "A claim matcher value must be a string, number, array, or predicate object; this key was given an unsupported type.",
    });
  }

  return predicate;
};
