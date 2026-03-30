import { addSeconds, subSeconds } from "@lindorm/date";
import { isArray, isNumber, isObject, isString } from "@lindorm/is";
import { KryptosAlgorithm } from "@lindorm/kryptos";
import { Dict, Predicate, PredicateOperator } from "@lindorm/types";
import { JwtClaims, VerifyJwtOptions } from "../../types";
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
      throw new Error(`Unsupported key: ${key as any} for JWT verification`);
  }
};

export const createJwtVerify = (
  algorithm: KryptosAlgorithm,
  verify: VerifyJwtOptions,
  clockTolerance: number,
): Predicate<Dict> => {
  const predicate: Partial<Record<keyof JwtClaims, PredicateOperator<any>>> = {
    iat: {
      $or: [{ $exists: false }, { $lte: addSeconds(new Date(), clockTolerance) }],
    },
    nbf: {
      $or: [{ $exists: false }, { $lte: addSeconds(new Date(), clockTolerance) }],
    },
    exp: {
      $or: [{ $exists: false }, { $gte: subSeconds(new Date(), clockTolerance) }],
    },
    auth_time: {
      $or: [{ $exists: false }, { $lte: addSeconds(new Date(), clockTolerance) }],
    },
  };

  for (const [key, value] of Object.entries(verify)) {
    const mapped = mapVerify(key as keyof VerifyJwtOptions);

    if (mapped === "at_hash" && isString(value)) {
      predicate[mapped] = { $eq: createAccessTokenHash(algorithm, value) };
      continue;
    }
    if (mapped === "c_hash" && isString(value)) {
      predicate[mapped] = { $eq: createCodeHash(algorithm, value) };
      continue;
    }
    if (mapped === "s_hash" && isString(value)) {
      predicate[mapped] = { $eq: createStateHash(algorithm, value) };
      continue;
    }
    if (isArray<string>(value)) {
      predicate[mapped] = { $all: value };
      continue;
    }
    if (isNumber(value)) {
      predicate[mapped] = { $eq: value };
      continue;
    }
    if (isString(value)) {
      predicate[mapped] = { $eq: value };
      continue;
    }
    if (isObject(value)) {
      predicate[mapped] = value as PredicateOperator<any>;
      continue;
    }

    throw new Error(`Unsupported value: ${value as any} for key: ${key}`);
  }

  return predicate as Predicate<Dict>;
};
