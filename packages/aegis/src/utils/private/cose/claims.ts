import { isNumberString } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { COSE_CLAIMS } from "../../../constants/private/cose";
import { AegisError } from "../../../errors";
import { CoseTarget, JwtClaims } from "../../../types";
import { fromBstr, toBstr } from "./bstr";
import { findCoseByKey, findCoseByLabel } from "./find";

export const mapCoseClaims = (
  claims: JwtClaims,
  target: CoseTarget = "internal",
): Map<number | string, unknown> => {
  const result = new Map<number | string, unknown>();

  for (const [key, value] of Object.entries(claims)) {
    if (isNumberString(key)) {
      const label = parseInt(key, 10);
      if (label < 900) {
        throw new AegisError(`Custom COSE claim label must be >= 900, got ${label}`);
      }
      if (target === "external") {
        result.set(key, value);
      } else {
        result.set(label, value);
      }
      continue;
    }

    const claim = findCoseByKey(COSE_CLAIMS, key);

    if (!claim) {
      result.set(key, value);
      continue;
    }

    if (target === "external" && claim.label >= 400) {
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
