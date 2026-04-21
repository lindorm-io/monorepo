import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { PredicateOperator } from "@lindorm/types";
import type { JwtClaimMatchers } from "./jwt-claim-matchers.js";

export type ValidateJwtOptions = JwtClaimMatchers & {
  algorithm?: KryptosAlgorithm;
  tokenType?: string | PredicateOperator<string>;
};
