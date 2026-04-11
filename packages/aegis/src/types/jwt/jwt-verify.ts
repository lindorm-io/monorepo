import { TokenType } from "../../constants/token-type";
import { JwtClaimMatchers } from "./jwt-claim-matchers";

export type VerifyActorOptions = {
  required?: boolean;
  forbidden?: boolean;
  allowedSubjects?: Array<string>;
  maxChainDepth?: number;
};

export type VerifyJwtOptions = JwtClaimMatchers & {
  actor?: VerifyActorOptions;
  dpopProof?: string;
  tokenType?: TokenType;
};
