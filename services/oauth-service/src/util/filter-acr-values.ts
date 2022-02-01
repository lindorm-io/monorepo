import { ALLOWED_ACR_VALUES } from "../constant";
import { LevelOfAssurance } from "../common";
import { filter, flatten, includes, isNaN, isString, last, uniq } from "lodash";

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

  const filteredLoa = filter(flatArray, (item) => includes(ALLOWED_ACR_VALUES, item));
  const filteredMethods = filter(flatArray, (item) => !includes(ALLOWED_ACR_VALUES, item));

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
