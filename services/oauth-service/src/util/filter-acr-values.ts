import { ALLOWED_ACR_VALUES } from "../constant";
import { AuthenticationMethod } from "../common";
import { LevelOfAssurance } from "@lindorm-io/jwt";
import { flatten, isNaN, last, uniq } from "lodash";

interface Options {
  acrArray?: Array<string> | null;
  acrValues?: string | null;
  amrArray?: Array<string> | null;
  amrValues?: string | null;
}

interface Result {
  levelOfAssurance: LevelOfAssurance;
  methods: Array<AuthenticationMethod>;
}

export const filterAcrValues = (options: Options = {}): Result => {
  const splitAcr = options.acrValues ? options.acrValues.toLowerCase().split(" ") : [];
  const splitAmr = options.amrValues ? options.amrValues.toLowerCase().split(" ") : [];

  const acrArray = options.acrArray || [];
  const amrArray = options.amrArray || [];

  const flatArray: Array<string> = uniq(flatten([splitAcr, splitAmr, acrArray, amrArray])).sort();

  if (!flatArray.length) {
    return {
      levelOfAssurance: 0,
      methods: [],
    };
  }

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
    levelOfAssurance: last(uniqLOA) || 0,
    methods: uniq(filteredMethods) as Array<AuthenticationMethod>,
  };
};
