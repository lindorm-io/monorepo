import { Dict } from "@lindorm/types";
import { COSE_CLAIMS } from "../../../constants/private/cose";
import { JwtClaims } from "../../../types";
import { fromBstr, toBstr } from "./bstr";
import { findCoseByKey, findCoseByLabel } from "./find";

export const mapCoseClaims = (claims: JwtClaims): Map<number | string, unknown> => {
  const result = new Map<number | string, unknown>();

  for (const [key, value] of Object.entries(claims)) {
    const claim = findCoseByKey(COSE_CLAIMS, key);

    if (!claim) {
      result.set(key, value);
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

export const decodeCoseClaims = <C extends Dict = Dict>(
  cose: Dict | Map<number | string, unknown>,
): JwtClaims & C => {
  const result: Dict = {};

  for (const [label, value] of iterateEntries(cose)) {
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
