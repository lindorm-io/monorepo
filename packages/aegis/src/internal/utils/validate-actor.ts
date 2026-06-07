import { Predicated } from "@lindorm/utils";
import type { ActClaim } from "../../types/claims/act-claim.js";
import type { TokenDelegation, VerifyActorOptions } from "../../types/jwt/index.js";

export type ActorValidationError = {
  message: string;
  debug?: { actor: ActClaim };
};

export const validateActor = (
  delegation: TokenDelegation,
  options: VerifyActorOptions | undefined,
): ActorValidationError | null => {
  if (!options) return null;

  if (options.required && !delegation.isDelegated) {
    return { message: "Expected delegated token with act claim" };
  }

  if (options.forbidden && delegation.isDelegated) {
    return { message: "Expected non-delegated token" };
  }

  if (
    options.maxChainDepth !== undefined &&
    delegation.actorChain.length > options.maxChainDepth
  ) {
    return { message: `Actor chain exceeds maximum depth of ${options.maxChainDepth}` };
  }

  if (options.allowedActors) {
    const predicate = options.allowedActors;
    const scope = options.actorScope ?? "every";

    switch (scope) {
      case "current": {
        const current = delegation.actorChain[0];
        if (!current || !Predicated.match(current, predicate)) {
          // The actor identifier is kept in debug, never in the client-facing message.
          return {
            message: "Actor not allowed",
            debug: current ? { actor: current } : undefined,
          };
        }
        break;
      }

      case "some": {
        if (!delegation.actorChain.some((entry) => Predicated.match(entry, predicate))) {
          return { message: "No actor in the chain matches the allowed predicate" };
        }
        break;
      }

      case "every":
      default: {
        for (const entry of delegation.actorChain) {
          if (!Predicated.match(entry, predicate)) {
            return { message: "Actor not allowed", debug: { actor: entry } };
          }
        }
        break;
      }
    }
  }

  return null;
};
