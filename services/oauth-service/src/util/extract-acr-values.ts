import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  LevelOfAssurance,
} from "@lindorm-io/common-types";
import { getLevelOfAssuranceFromAuthenticationLevel } from "./get-level-of-assurance-from-authentication-level";
import { getVerifiedAcrValues } from "./get-verified-acr-values";

type Result = {
  factors: Array<AuthenticationFactor>;
  levelOfAssurance: LevelOfAssurance;
  methods: Array<AuthenticationMethod>;
  strategies: Array<AuthenticationStrategy>;
};

export const extractAcrValues = (acr?: string): Result => {
  const acrValues = getVerifiedAcrValues(acr ? acr.split(" ") : []);

  return {
    factors: acrValues.filter((x: any) =>
      Object.values(AuthenticationFactor).includes(x),
    ) as Array<AuthenticationFactor>,
    levelOfAssurance: getLevelOfAssuranceFromAuthenticationLevel(acrValues),
    methods: acrValues.filter((x: any) =>
      Object.values(AuthenticationMethod).includes(x),
    ) as Array<AuthenticationMethod>,
    strategies: acrValues.filter((x: any) =>
      Object.values(AuthenticationStrategy).includes(x),
    ) as Array<AuthenticationStrategy>,
  };
};
