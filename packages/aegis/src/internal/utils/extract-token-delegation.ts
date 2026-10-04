import { omitUndefined } from "@lindorm/utils";
import type { ActClaim } from "../../types/claims/domain/act-claim.js";
import type { TokenDelegation } from "../../types/domain/delegation.js";

const walkActChain = (act: ActClaim | undefined): Array<ActClaim> => {
  const chain: Array<ActClaim> = [];
  let current = act;
  while (current) {
    chain.push(
      omitUndefined({
        subject: current.subject,
        issuer: current.issuer,
        clientId: current.clientId,
      }),
    );
    current = current.act;
  }
  return chain;
};

export const extractTokenDelegation = (act: ActClaim | undefined): TokenDelegation => {
  const actorChain = walkActChain(act);
  return {
    currentActor: actorChain[0]?.subject,
    actorChain,
    isDelegated: actorChain.length > 0,
  };
};
