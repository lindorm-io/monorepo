import type { TokenType } from "../../constants/token-type.js";
import type { JwtClaimMatchers } from "./jwt-claim-matchers.js";

export type VerifyActorOptions = {
  required?: boolean;
  forbidden?: boolean;
  allowedSubjects?: Array<string>;
  maxChainDepth?: number;
};

export type VerifyJwtOptions = JwtClaimMatchers & {
  actor?: VerifyActorOptions;
  dpopProof?: string;
  /**
   * When true, aegis will not raise an error if the token carries a
   * `cnf.jkt` binding but no `dpopProof` was supplied to this verify call.
   * The caller asserts the DPoP binding is enforced out-of-band (for
   * example, pylon's socket auth establishes the jkt binding at handshake
   * time and trusts it for the remainder of the socket lifetime). Default
   * behaviour (undefined/false) is RFC 9449 strict: a bound token without
   * a proof is rejected.
   */
  trustBoundThumbprint?: boolean;
  tokenType?: TokenType;
};
