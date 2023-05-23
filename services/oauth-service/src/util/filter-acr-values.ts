import {
  AuthenticationMethod,
  AuthenticationStrategy,
  LevelOfAssurance,
} from "@lindorm-io/common-types";
import { flatten, isNaN, last, uniq } from "lodash";
import { ALLOWED_LOA_VALUES } from "../constant";

type Options = {
  acrArray?: Array<string> | null;
  acrString?: string | null;
  amrArray?: Array<string> | null;
  amrString?: string | null;
};

type Result = {
  levelOfAssurance: LevelOfAssurance;
  methods: Array<AuthenticationMethod>;
  strategies: Array<AuthenticationStrategy>;
};

export const filterAcrValues = (options: Options = {}): Result => {
  const splitAcr = options.acrString ? options.acrString.toLowerCase().split(" ") : [];
  const splitAmr = options.amrString ? options.amrString.toLowerCase().split(" ") : [];

  const acrArray = options.acrArray || [];
  const amrArray = options.amrArray || [];

  const flatArray: Array<string> = uniq(flatten([splitAcr, splitAmr, acrArray, amrArray])).sort();

  if (!flatArray.length) {
    return {
      levelOfAssurance: 0,
      methods: [],
      strategies: [],
    };
  }

  const filteredLoa = flatArray.filter((item) => ALLOWED_LOA_VALUES.includes(item));
  const filteredMethods = flatArray.filter((item) =>
    Object.values<string>(AuthenticationMethod).includes(item),
  );
  const filteredStrategies = flatArray.filter((item) =>
    Object.values<string>(AuthenticationStrategy).includes(item),
  );

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
    strategies: uniq(filteredStrategies) as Array<AuthenticationStrategy>,
  };
};
