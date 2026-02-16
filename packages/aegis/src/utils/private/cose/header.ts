import { Dict } from "@lindorm/types";
import { COSE_ALGORITHM, COSE_HEADER } from "../../../constants/private";
import { AegisError } from "../../../errors";
import { RawTokenHeaderClaims } from "../../../types";
import { fromBstr, toBstr } from "./bstr";
import { decodeCoseCrit, mapCoseCrit } from "./crit";
import { findCoseByKey, findCoseByLabel } from "./find";
import { decodeCoseKey, mapCoseKey } from "./key";

export const mapCoseHeader = (claims: RawTokenHeaderClaims): Dict => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(claims)) {
    if (!value) continue;

    const claim = findCoseByKey(COSE_HEADER, key);

    if (!claim) {
      result[key] = value;
      continue;
    }

    if (key === "alg") {
      const alg = findCoseByKey(COSE_ALGORITHM, value);
      if (!alg) {
        throw new AegisError(`Unsupported COSE algorithm: ${value as any}`);
      }
      result[claim.label] = alg.label;
      continue;
    }

    if (key === "crit") {
      result[claim.label] = mapCoseCrit(value);
      continue;
    }

    if (key === "epk" || key === "jwk") {
      result[claim.label] = mapCoseKey(value);
      continue;
    }

    result[claim.label] = toBstr(claim, value);
    continue;
  }

  return result;
};

export const decodeCoseHeader = (cose: Dict): RawTokenHeaderClaims => {
  const result: Dict = {};

  for (const [label, value] of Object.entries(cose)) {
    if (!value) continue;

    const claim = findCoseByLabel(COSE_HEADER, label);

    if (!claim) {
      result[label] = value;
      continue;
    }

    if (claim.key === "alg") {
      const alg = findCoseByLabel(COSE_ALGORITHM, value);
      if (!alg) {
        throw new AegisError(`Unsupported COSE algorithm: ${value}`);
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
