import type { TokenDelegation, VerifyActorOptions } from "../../types/jwt/index.js";

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

  if (options.allowedSubjects) {
    for (const entry of delegation.actorChain) {
      if (!entry.subject || !options.allowedSubjects.includes(entry.subject)) {
        return `Actor subject not allowed: ${entry.subject ?? "undefined"}`;
      }
    }
  }

  return null;
};
