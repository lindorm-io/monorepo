import { Dict } from "@lindorm/types";
import { COSE_ALGORITHM, COSE_HEADER } from "../../../constants/private";
import { AegisError } from "../../../errors";
import { CoseTarget, RawTokenHeaderClaims } from "../../../types";
import { fromBstr, toBstr } from "./bstr";
import { decodeCoseCrit, mapCoseCrit } from "./crit";
import { findCoseByKey, findCoseByLabel } from "./find";
import { decodeCoseKey, mapCoseKey } from "./key";

export const mapCoseHeader = (
  claims: RawTokenHeaderClaims,
  target: CoseTarget = "internal",
): Map<number | string, unknown> => {
  const result = new Map<number | string, unknown>();

  for (const [key, value] of Object.entries(claims)) {
    if (!value) continue;

    const claim = findCoseByKey(COSE_HEADER, key);

    if (!claim) {
      result.set(key, value);
      continue;
    }

    if (target === "external" && claim.label >= 400) {
      result.set(key, value);
      continue;
    }

    if (key === "alg") {
      const alg = findCoseByKey(COSE_ALGORITHM, value);
      if (!alg) {
        throw new AegisError(`Unsupported COSE algorithm: ${value as any}`);
      }
      result.set(claim.label, alg.label);
      continue;
    }

    if (key === "crit") {
      result.set(claim.label, mapCoseCrit(value));
      continue;
    }

    if (key === "epk" || key === "jwk") {
      result.set(claim.label, mapCoseKey(value));
      continue;
    }

    result.set(claim.label, toBstr(claim, value));
    continue;
  }

  return result;
};

const iterateEntries = (
  cose: Dict | Map<number | string, unknown>,
): Array<[string, unknown]> =>
  cose instanceof Map
    ? Array.from(cose.entries()).map(([k, v]) => [String(k), v])
    : Object.entries(cose);

export const decodeCoseHeader = (
  cose: Dict | Map<number | string, unknown>,
): RawTokenHeaderClaims => {
  const result: Dict = {};

  for (const [label, value] of iterateEntries(cose)) {
    if (!value) continue;

    const claim = findCoseByLabel(COSE_HEADER, label);

    if (!claim) {
      result[label] = value;
      continue;
    }

    if (claim.key === "alg") {
      const alg = findCoseByLabel(COSE_ALGORITHM, value);
      if (!alg) {
        throw new AegisError(`Unsupported COSE algorithm: ${String(value)}`);
      }
      result["alg"] = alg.key;
      continue;
    }

    if (claim.key === "crit") {
      result[claim.key] = decodeCoseCrit(value);
      continue;
    }

    if (claim.key === "epk" || claim.key === "jwk") {
      result[claim.key] = decodeCoseKey(value);
      continue;
    }

    result[claim.key] = fromBstr(claim, value);
    continue;
  }

  return result as RawTokenHeaderClaims;
};
