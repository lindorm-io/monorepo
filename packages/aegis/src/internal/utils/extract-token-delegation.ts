import { removeUndefined } from "@lindorm/utils";
import { ActClaim, ActClaimWire } from "../../types/jwt/jwt-act";
import { TokenDelegation } from "../../types/jwt/jwt-delegation";

const walkActChain = (act: ActClaimWire | undefined): Array<ActClaim> => {
  const chain: Array<ActClaim> = [];
  let current = act;
  while (current) {
    chain.push(
      removeUndefined({
        subject: current.sub,
        issuer: current.iss,
        audience: current.aud,
        clientId: current.client_id,
      }),
    );
    current = current.act;
  }
  return chain;
};

export const extractTokenDelegation = (payload: {
  act?: ActClaimWire;
}): TokenDelegation => {
  const actorChain = walkActChain(payload.act);
  return {
    currentActor: actorChain[0]?.subject,
    actorChain,
    isDelegated: actorChain.length > 0,
  };
};
