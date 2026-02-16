import { isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { COSE_KEY_CURVE, COSE_KEY_TYPE } from "../../../constants/private";
import { AegisError } from "../../../errors";
import { fromBstr, toBstr } from "./bstr";
import { findCoseByKey, findCoseByLabel, findSpecificCoseKey } from "./find";

export const mapCoseKey = (jwk: any): Map<number | string, unknown> => {
  if (!isObject(jwk)) {
    throw new AegisError(`Invalid COSE key: ${jwk}`);
  }

  const kty = jwk["kty"];

  if (!kty) {
    throw new AegisError("Missing COSE key type", { debug: { jwk } });
  }

  const coseKey = findSpecificCoseKey(kty);

  const result = new Map<number | string, unknown>();

  for (const [key, value] of Object.entries(jwk)) {
    const claim = findCoseByKey(coseKey, key);

    if (!claim) {
      result.set(key, value);
      continue;
    }

    if (key === "crv") {
      const crv = findCoseByKey(COSE_KEY_CURVE, value);
      if (!crv) {
        throw new AegisError(`Unsupported COSE key curve: ${String(value)}`);
      }
      result.set(claim.label, crv.label);
      continue;
    }

    if (key === "kty") {
      const kty = findCoseByKey(COSE_KEY_TYPE, value);
      if (!kty) {
        throw new AegisError(`Unsupported COSE key type: ${String(value)}`);
      }
      result.set(claim?.label ?? key, kty.label);
      continue;
    }

    result.set(claim.label, toBstr(claim, value));
    continue;
  }

  return result;
};

const iterateKeyEntries = (cose: any): Array<[string, unknown]> =>
  cose instanceof Map
    ? Array.from(cose.entries()).map(([k, v]) => [String(k), v])
    : Object.entries(cose);

const getKeyTypeValue = (cose: any): unknown =>
  cose instanceof Map ? cose.get(1) : cose[1];

export const decodeCoseKey = (cose: any): Dict => {
  if (!isObject(cose) && !(cose instanceof Map)) {
    throw new AegisError(`Invalid COSE key: ${cose}`);
  }

  const result: Dict = {};

  const kty = findCoseByLabel(COSE_KEY_TYPE, getKeyTypeValue(cose));
  const coseKey = findSpecificCoseKey(kty!.key);

  for (const [label, value] of iterateKeyEntries(cose)) {
    const claim = findCoseByLabel(coseKey, label);

    if (!claim) {
      result[label] = value;
      continue;
    }

    if (claim.key === "crv") {
      const crv = findCoseByLabel(COSE_KEY_CURVE, value);
      if (!crv) {
        throw new AegisError(`Unsupported COSE key curve: ${String(value)}`);
      }
      result[claim.key] = crv.key;
      continue;
    }

    if (claim.key === "kty") {
      const kty = findCoseByLabel(COSE_KEY_TYPE, value);
      if (!kty) {
        throw new AegisError(`Unsupported COSE key type: ${String(value)}`);
      }
      result[claim.key] = kty.key;
      continue;
    }

    result[claim.key] = fromBstr(claim, value);
    continue;
  }

  return result;
};
