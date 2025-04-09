import { isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { COSE_KEY_CURVE, COSE_KEY_TYPE } from "../../../constants/private";
import { AegisError } from "../../../errors";
import { fromBstr, toBstr } from "./bstr";
import { findCoseByKey, findCoseByLabel, findSpecificCoseKey } from "./find";

export const mapCoseKey = (jwk: any): Dict => {
  if (!isObject(jwk)) {
    throw new AegisError(`Invalid COSE key: ${jwk}`);
  }

  const kty = jwk["kty"];

  if (!kty) {
    throw new AegisError("Missing COSE key type", { debug: { jwk } });
  }

  const coseKey = findSpecificCoseKey(kty);

  const result: Dict = {};

  for (const [key, value] of Object.entries(jwk)) {
    const claim = findCoseByKey(coseKey, key);

    if (!claim) {
      result[key] = value;
      continue;
    }

    if (key === "crv") {
      const crv = findCoseByKey(COSE_KEY_CURVE, value);
      if (!crv) {
        throw new AegisError(`Unsupported COSE key curve: ${value}`);
      }
      result[claim.label] = crv.label;
      continue;
    }

    if (key === "kty") {
      const kty = findCoseByKey(COSE_KEY_TYPE, value);
      if (!kty) {
        throw new AegisError(`Unsupported COSE key type: ${value}`);
      }
      result[claim?.label ?? key] = kty.label;
      continue;
    }

    result[claim.label] = toBstr(claim, value);
    continue;
  }

  return result;
};

export const decodeCoseKey = (cose: any): Dict => {
  if (!isObject(cose)) {
    throw new AegisError(`Invalid COSE key: ${cose}`);
  }

  const result: Dict = {};

  const kty = findCoseByLabel(COSE_KEY_TYPE, cose[1]);
  const coseKey = findSpecificCoseKey(kty!.key);

  for (const [label, value] of Object.entries(cose)) {
    const claim = findCoseByLabel(coseKey, label);

    if (!claim) {
      result[label] = value;
      continue;
    }

    if (claim.key === "crv") {
      const crv = findCoseByLabel(COSE_KEY_CURVE, value);
      if (!crv) {
        throw new AegisError(`Unsupported COSE key curve: ${value}`);
      }
      result[claim.key] = crv.key;
      continue;
    }

    if (claim.key === "kty") {
      const kty = findCoseByLabel(COSE_KEY_TYPE, value);
      if (!kty) {
        throw new AegisError(`Unsupported COSE key type: ${value}`);
      }
      result[claim.key] = kty.key;
      continue;
    }

    result[claim.key] = fromBstr(claim, value);
    continue;
  }

  return result;
};
