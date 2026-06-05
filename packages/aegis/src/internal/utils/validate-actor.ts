import { Predicated } from "@lindorm/utils";
import type { ActClaim } from "../../types/claims/act-claim.js";
import type { TokenDelegation, VerifyActorOptions } from "../../types/jwt/index.js";

const describeActor = (actor: ActClaim): string =>
  actor.subject ?? actor.clientId ?? "undefined";

export const validateActor = (
  delegation: TokenDelegation,
  options: VerifyActorOptions | undefined,
): string | null => {
  if (!options) return null;

  if (options.required && !delegation.isDelegated) {
    return "Expected delegated token with act claim";
  }

  if (options.forbidden && delegation.isDelegated) {
    return "Expected non-delegated token";
  }

  if (
    options.maxChainDepth !== undefined &&
    delegation.actorChain.length > options.maxChainDepth
  ) {
    return `Actor chain exceeds maximum depth of ${options.maxChainDepth}`;
  }

  if (options.allowedActors) {
    const predicate = options.allowedActors;
    const scope = options.actorScope ?? "every";

    switch (scope) {
      case "current": {
        const current = delegation.actorChain[0];
        if (!current || !Predicated.match(current, predicate)) {
          return `Actor not allowed: ${current ? describeActor(current) : "undefined"}`;
        }
        break;
      }

      case "some": {
        if (!delegation.actorChain.some((entry) => Predicated.match(entry, predicate))) {
          return "No actor in the chain matches the allowed predicate";
        }
        break;
      }

      case "every":
      default: {
        for (const entry of delegation.actorChain) {
          if (!Predicated.match(entry, predicate)) {
            return `Actor not allowed: ${describeActor(entry)}`;
          }
        }
        break;
      }
    }
  }

  return null;
};
