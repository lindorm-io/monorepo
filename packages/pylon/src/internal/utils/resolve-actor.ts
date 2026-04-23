import type { PylonCommonContext } from "../../types/index.js";

export type ActorResolver = (ctx: PylonCommonContext) => string;

const defaultActorResolver: ActorResolver = (ctx) => {
  const tokens = ctx.state?.tokens as any;

  const accessSub = tokens?.accessToken?.claims?.sub;
  if (typeof accessSub === "string" && accessSub.length > 0) return accessSub;

  const idSub = tokens?.idToken?.claims?.sub;
  if (typeof idSub === "string" && idSub.length > 0) return idSub;

  const authorization = ctx.state?.authorization;
  if (authorization?.type === "basic" && typeof authorization.value === "string") {
    try {
      const decoded = Buffer.from(authorization.value, "base64").toString("utf-8");
      const [username] = decoded.split(":");
      if (username && username.length > 0) return username;
    } catch {
      /* ignore malformed basic auth */
    }
  }

  return "unknown";
};

/**
 * Resolves the actor for the current request, memoising on `ctx.state.actor`.
 * The initial state is `"unknown"` (set by the state-init middleware). A
 * non-"unknown" cached value short-circuits; a cached `"unknown"` is treated
 * as "not yet resolved" and re-runs the resolver — cheap and idempotent
 * because tokens/basic-auth may only populate later in the request lifecycle.
 */
export const resolveActor = (
  ctx: PylonCommonContext,
  configured?: ActorResolver,
): string => {
  const state = ctx.state as PylonCommonContext["state"] | undefined;
  if (state?.actor && state.actor !== "unknown") return state.actor;

  const resolver = configured ?? defaultActorResolver;
  const resolved = resolver(ctx);

  if (state) {
    state.actor = resolved;
  }

  return resolved;
};
