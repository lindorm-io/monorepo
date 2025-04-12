import { isArray } from "@lindorm/is";
import { uniq } from "@lindorm/utils";
import { COSE_HEADER } from "../../../constants/private";
import { AegisError } from "../../../errors";
import { findCoseByKey, findCoseByLabel } from "./find";

export const mapCoseCrit = (crit: any): Array<string | number> => {
  if (!isArray(crit)) {
    throw new AegisError(`Invalid COSE crit: ${crit}`);
  }

  const result: Array<any> = [];

  for (const key of crit) {
    const claim = findCoseByKey(COSE_HEADER, key);

    if (!claim) {
      result.push(key);
      continue;
    }

    result.push(claim.label);
    continue;
  }

  return result;
};

export const decodeCoseCrit = (crit: any): Array<string> => {
  if (!isArray(crit)) {
    throw new AegisError(`Invalid COSE crit: ${crit}`);
  }

  const result: Array<string> = [];

  for (const label of crit) {
    const claim = findCoseByLabel(COSE_HEADER, label);

    if (!claim) {
      result.push(label as string);
      continue;
    }

    result.push(claim.key);
    continue;
  }

  return uniq(result);
};
