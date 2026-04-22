import type { PylonContext } from "../../types/index.js";

export type ActorResolver = (ctx: PylonContext) => string | null;

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

  return null;
};

/**
 * Resolves the actor for the current request, memoising on `ctx.state.actor`.
 * The first call runs the configured resolver (or the default) and stores the
 * result. Subsequent calls return the cached value.
 *
 * A non-null cached value short-circuits. A null cached value is treated as
 * "not yet resolved" — re-running the default resolver when the value is null
 * is cheap and idempotent (tokens may have been populated in the meantime).
 */
export const resolveActor = (
  ctx: PylonContext,
  configured?: ActorResolver,
): string | null => {
  if (ctx.state?.actor) return ctx.state.actor;

  const resolver = configured ?? defaultActorResolver;
  const resolved = resolver(ctx);

  if (ctx.state) {
    ctx.state.actor = resolved;
  }

  return resolved;
};
