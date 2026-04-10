import { ActClaim } from "./jwt-act";

// Delegation summary derived from the token's `act` claim chain.
// Subject lives on the payload (payload.subject). This type focuses
// purely on "how is the token being used" — the actor chain and its state.
export type TokenDelegation = {
  currentActor: string | undefined;
  actorChain: Array<ActClaim>;
  isDelegated: boolean;
};
