import type { Predicate } from "@lindorm/types";
import type { TokenType } from "../../constants/token-type.js";
import type { ActClaim } from "../claims/act-claim.js";
import type { JwtClaimMatchers } from "./jwt-claim-matchers.js";

// How `allowedActors` is applied to the token's actor chain:
// - "every"   (default) every actor in the chain must match the predicate.
//             Fail-closed; the only scope that catches an unauthorized
//             intermediary, since aegis does not validate `may_act`.
// - "current" only the immediate actor (actorChain[0]) must match. Trusts
//             the rest of the chain — "is my caller allowed".
// - "some"    at least one actor matches. Attestation ("token passed
//             through gateway G at some point").
export type ActorScope = "every" | "current" | "some";

export type VerifyActorOptions = {
  required?: boolean;
  forbidden?: boolean;
  allowedActors?: Predicate<ActClaim>;
  actorScope?: ActorScope;
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
