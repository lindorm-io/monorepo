import { KryptosAlgorithm } from "@lindorm/kryptos";
import { PredicateOperator } from "@lindorm/types";
import { JwtClaimMatchers } from "./jwt-claim-matchers";

export type ValidateJwtOptions = JwtClaimMatchers & {
  algorithm?: KryptosAlgorithm;
  tokenType?: string | PredicateOperator<string>;
};
