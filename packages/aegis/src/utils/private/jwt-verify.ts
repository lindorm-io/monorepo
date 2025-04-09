import { addSeconds, subSeconds } from "@lindorm/date";
import { isArray, isNumber, isObject, isString } from "@lindorm/is";
import { KryptosAlgorithm } from "@lindorm/kryptos";
import { Dict } from "@lindorm/types";
import { JwtClaims, Operators, VerifyJwtOptions } from "../../types";
import { createAccessTokenHash, createCodeHash, createStateHash } from "./create-hash";

const mapVerify = (key: keyof VerifyJwtOptions): keyof JwtClaims => {
  switch (key) {
    case "accessToken":
      return "at_hash";
    case "adjustedAccessLevel":
      return "aal";
    case "audience":
      return "aud";
    case "authCode":
      return "c_hash";
    case "authContextClass":
      return "acr";
    case "authFactor":
      return "afr";
    case "authMethods":
      return "amr";
    case "authorizedParty":
      return "azp";
    case "authState":
      return "s_hash";
    case "authTime":
      return "auth_time";
    case "clientId":
      return "cid";
    case "grantType":
      return "gty";
    case "issuer":
      return "iss";
    case "levelOfAssurance":
      return "loa";
    case "nonce":
      return "nonce";
    case "permissions":
      return "per";
    case "roles":
      return "rls";
    case "scope":
      return "scope";
    case "sessionHint":
      return "sih";
    case "subject":
      return "sub";
    case "subjectHint":
      return "suh";
    case "tenantId":
      return "tid";
    case "tokenType":
      return "token_type";
    default:
      throw new Error(`Unsupported key: ${key}`);
  }
};

export const createJwtVerify = (
  algorithm: KryptosAlgorithm,
  verify: VerifyJwtOptions,
  clockTolerance: number,
): Dict<Operators> => {
  const ops: Partial<Record<keyof JwtClaims, Operators>> = {
    iat: {
      $or: [{ $exists: false }, { $beforeOrEq: addSeconds(new Date(), clockTolerance) }],
    },
    nbf: {
      $or: [{ $exists: false }, { $beforeOrEq: addSeconds(new Date(), clockTolerance) }],
    },
    exp: {
      $or: [{ $exists: false }, { $afterOrEq: subSeconds(new Date(), clockTolerance) }],
    },
    auth_time: {
      $or: [{ $exists: false }, { $beforeOrEq: addSeconds(new Date(), clockTolerance) }],
    },
  };

  for (const [key, value] of Object.entries(verify)) {
    const mapped = mapVerify(key as keyof VerifyJwtOptions);

    if (mapped === "at_hash" && isString(value)) {
      ops[mapped] = { $eq: createAccessTokenHash(algorithm, value) };
      continue;
    }
    if (mapped === "c_hash" && isString(value)) {
      ops[mapped] = { $eq: createCodeHash(algorithm, value) };
      continue;
    }
    if (mapped === "s_hash" && isString(value)) {
      ops[mapped] = { $eq: createStateHash(algorithm, value) };
      continue;
    }
    if (isArray<string>(value)) {
      ops[mapped] = { $all: value };
      continue;
    }
    if (isNumber(value)) {
      ops[mapped] = { $eq: value };
      continue;
    }
    if (isString(value)) {
      ops[mapped] = { $eq: value };
      continue;
    }
    if (isObject(value)) {
      ops[mapped] = value as Operators;
      continue;
    }

    throw new Error(`Unsupported value: ${value} for key: ${key}`);
  }

  return ops;
};
