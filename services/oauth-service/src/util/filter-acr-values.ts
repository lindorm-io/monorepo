import { ALLOWED_ACR_VALUES } from "../constant";
import { LevelOfAssurance } from "@lindorm-io/jwt";
import { flatten, isNaN, isString, last, uniq } from "lodash";

interface Result {
  authenticationMethods: Array<string>;
  levelOfAssurance: LevelOfAssurance;
}

export const filterAcrValues = (
  acrValuesString: string | null,
  acrValuesArray: Array<string> = [],
  amrValuesArray: Array<string> = [],
): Result => {
  if (!isString(acrValuesString) && !acrValuesArray.length) {
    return {
      authenticationMethods: [],
      levelOfAssurance: 0,
    };
  }

  const splitArray = acrValuesString ? acrValuesString.toLowerCase().split(" ") : [];

  const flatArray: Array<string> = uniq(flatten([splitArray, acrValuesArray, amrValuesArray]));

  const filteredLoa = flatArray.filter((item) => ALLOWED_ACR_VALUES.includes(item));
  const filteredMethods = flatArray.filter((item) => !ALLOWED_ACR_VALUES.includes(item));

  const loa: Array<number> = [];

  for (const item of filteredLoa) {
    const number = parseInt(item.replace("loa_", ""), 10);

    if (isNaN(number)) continue;

    loa.push(number);
  }

  const uniqLOA = uniq(loa).sort() as Array<LevelOfAssurance>;

  return {
    authenticationMethods: uniq(filteredMethods),
    levelOfAssurance: last(uniqLOA) || 0,
  };
};
