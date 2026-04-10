import { ActClaim, TokenDelegation } from "../../types/jwt/jwt-claims";

const walkActChain = (act: ActClaim | undefined): Array<ActClaim> => {
  const chain: Array<ActClaim> = [];
  let current = act;
  while (current) {
    const { act: next, ...rest } = current;
    chain.push(rest);
    current = next;
  }
  return chain;
};

export const extractTokenDelegation = (payload: { act?: ActClaim }): TokenDelegation => {
  const actorChain = walkActChain(payload.act);
  return {
    currentActor: actorChain[0]?.sub,
    actorChain,
    isDelegated: actorChain.length > 0,
  };
};
