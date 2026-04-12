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
      return "client_id";
    case "entitlements":
      return "entitlements";
    case "grantType":
      return "gty";
    case "groups":
      return "groups";
    case "issuer":
      return "iss";
    case "levelOfAssurance":
      return "loa";
    case "nonce":
      return "nonce";
    case "permissions":
      return "permissions";
    case "roles":
      return "roles";
    case "scope":
      return "scope";
    case "sessionHint":
      return "sih";
    case "subject":
      return "sub";
    case "subjectHint":
      return "suh";
    case "tenantId":
      return "tenant_id";
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

  // Claims whose payload value is always stored as an array.
  // For these, a string verifier value means "at least this one must be
  // present" — so the predicate must be $all over a single-element array,
  // not $eq against the raw string (which would fail because array ≠ string).
  const ARRAY_CLAIM_KEYS: ReadonlySet<string> = new Set([
    "aud",
    "amr",
    "afr",
    "scope",
    "roles",
    "permissions",
    "groups",
    "entitlements",
  ]);

  for (const [key, value] of Object.entries(verify)) {
    // tokenType is validated against the JOSE `typ` header by each Kit directly
    if (key === "tokenType") continue;
    // actor is validated against the parsed TokenDelegation by each Kit directly
    if (key === "actor") continue;
    // dpopProof is validated against the cnf.jkt claim by each Kit directly
    if (key === "dpopProof") continue;
    // trustBoundThumbprint is a binary flag consumed by each Kit directly
    if (key === "trustBoundThumbprint") continue;

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
      // For claims stored as arrays on the payload side, a string verifier
      // must match "contained in the array" — lift to a single-element $all.
      if (ARRAY_CLAIM_KEYS.has(mapped)) {
        predicate[mapped] = { $all: [value] };
        continue;
      }
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
