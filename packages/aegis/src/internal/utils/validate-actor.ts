import { Matcher } from "@lindorm/match";
import type { ActClaim } from "../../types/claims/domain/act-claim.js";
import type { TokenDelegation, VerifyActorOptions } from "../../types/domain/index.js";
import { constrainsNothing } from "./constrains-nothing.js";

export type ActorValidationError = {
  code: "actor_not_allowed" | "actor_policy_invalid";
  message: string;
  debug?: { actor: ActClaim };
};

export const validateActor = (
  delegation: TokenDelegation,
  options: VerifyActorOptions | undefined,
): ActorValidationError | null => {
  if (!options) return null;

  // A condition that states nothing, or that contains a sub-condition that
  // does, reads as an allowlist at the call site while no actor this verifier
  // can test against it can fail it — so it is refused before it is applied,
  // and ahead of the token-shaped checks below, so no failing token can answer
  // in its place. The option's own absence stays legal: it states no actor
  // policy.
  if (options.allowedActor && constrainsNothing(options.allowedActor)) {
    return {
      code: "actor_policy_invalid",
      message: "Expected allowedActor to state a condition",
    };
  }

  if (options.required && !delegation.isDelegated) {
    return {
      code: "actor_not_allowed",
      message: "Expected delegated token with act claim",
    };
  }

  if (options.forbidden && delegation.isDelegated) {
    return { code: "actor_not_allowed", message: "Expected non-delegated token" };
  }

  if (
    options.maxChainDepth !== undefined &&
    delegation.actorChain.length > options.maxChainDepth
  ) {
    return {
      code: "actor_not_allowed",
      message: `Actor chain exceeds maximum depth of ${options.maxChainDepth}`,
    };
  }

  if (options.allowedActor) {
    const current = delegation.actorChain[0];

    // An ABSENT actor is refused here rather than left to the condition:
    // `Matcher` negates two-valuedly, so a condition stated as a denial
    // (`$not`, `$exists: false`) is SATISFIED by an actor that is not there.
    // Pinned by `Aegis.delegation.feature` "a verifier whose actor allowlist names
    // the parties it refuses still refuses a token presented by its own subject".
    if (!current || !Matcher.match(current, options.allowedActor)) {
      return {
        code: "actor_not_allowed",
        message: "Actor not allowed",
        debug: current ? { actor: current } : undefined,
      };
    }
  }

  return null;
};
