import { Dict } from "@lindorm/types";
import { COSE_CLAIMS } from "../../../constants/private/cose";
import { JwtClaims } from "../../../types";
import { fromBstr, toBstr } from "./bstr";
import { findCoseByKey, findCoseByLabel } from "./find";

export const mapCoseClaims = (claims: JwtClaims): Dict => {
  const result: Dict = {};

  for (const [key, value] of Object.entries(claims)) {
    const claim = findCoseByKey(COSE_CLAIMS, key);

    if (!claim) {
      result[key] = value;
      continue;
    }

    result[claim.label] = toBstr(claim, value);
    continue;
  }

  return result;
};

export const decodeCoseClaims = <C extends Dict = Dict>(cose: Dict): JwtClaims & C => {
  const result: Dict = {};

  for (const [label, value] of Object.entries(cose)) {
    const claim = findCoseByLabel(COSE_CLAIMS, label);

    if (!claim) {
      result[label] = value;
      continue;
    }

    result[claim.key] = fromBstr(claim, value);
    continue;
  }

  return result as JwtClaims & C;
};
