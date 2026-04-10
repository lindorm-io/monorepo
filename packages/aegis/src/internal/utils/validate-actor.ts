import { TokenIdentity, VerifyActorOptions } from "../../types/jwt";

export const validateActor = (
  identity: TokenIdentity,
  options: VerifyActorOptions | undefined,
): string | null => {
  if (!options) return null;

  if (options.required && !identity.isDelegated) {
    return "Expected delegated token with act claim";
  }

  if (options.forbidden && identity.isDelegated) {
    return "Expected non-delegated token";
  }

  if (
    options.maxChainDepth !== undefined &&
    identity.actorChain.length > options.maxChainDepth
  ) {
    return `Actor chain exceeds maximum depth of ${options.maxChainDepth}`;
  }

  if (options.allowedSubjects) {
    for (const entry of identity.actorChain) {
      if (!entry.sub || !options.allowedSubjects.includes(entry.sub)) {
        return `Actor subject not allowed: ${entry.sub ?? "undefined"}`;
      }
    }
  }

  return null;
};
