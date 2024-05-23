import { isArray, isNumber, isObject, isString } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { Operators, ValidateJwtOptions } from "../../types";
import { createAccessTokenHash, createCodeHash, createStateHash } from "./create-hash";

export const createJwtValidate = (validate: ValidateJwtOptions): Dict<Operators> => {
  const algorithm = validate.algorithm;
  const ops: Dict<Operators> = {};

  for (const [key, value] of Object.entries(validate)) {
    if (key === "algorithm") continue;

    if (key === "accessToken" && algorithm && isString(value)) {
      ops[key] = { $eq: createAccessTokenHash(algorithm, value) };
      continue;
    }
    if (key === "authCode" && algorithm && isString(value)) {
      ops[key] = { $eq: createCodeHash(algorithm, value) };
      continue;
    }
    if (key === "authState" && algorithm && isString(value)) {
      ops[key] = { $eq: createStateHash(algorithm, value) };
      continue;
    }
    if (isArray<string>(value)) {
      ops[key] = { $all: value };
      continue;
    }
    if (isNumber(value)) {
      ops[key] = { $eq: value };
      continue;
    }
    if (isString(value)) {
      ops[key] = { $eq: value };
      continue;
    }
    if (isObject(value)) {
      ops[key] = value as Operators;
      continue;
    }

    throw new Error(`Unsupported value: ${value} for key: ${key}`);
  }

  return ops;
};
