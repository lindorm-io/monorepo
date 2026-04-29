import type { IProteusSource } from "@lindorm/proteus";
import { lazyFactory } from "@lindorm/utils";
import { buildProteusSessionOptions } from "../../internal/utils/build-session-options.js";
import { resolveActor, type ActorResolver } from "../../internal/utils/resolve-actor.js";
import type { PylonContext, PylonMiddleware } from "../../types/index.js";

export type AttachProteusSourceOptions = {
  /** ctx key where the session will be exposed (e.g. "proteus", "analyticsProteus"). */
  key: string;
  /** The ProteusSource instance whose `session()` will be bound. */
  source: IProteusSource;
  /** Optional actor resolver — returns a string (use `"unknown"` for unauthenticated/system calls). */
  actor?: ActorResolver;
};

/**
 * Pylon middleware that lazily attaches a Proteus session to `ctx[options.key]`.
 * The session is only created on first read, receives the per-request logger
 * and hook metadata (with resolved `actor`), and forwards `ctx.signal` only
 * when the context is HTTP. The actor is resolved through `resolveActor` so
 * all consumers share a memoised `ctx.state.actor` value.
 */
export const createAttachProteusSourceMiddleware = <
  C extends PylonContext = PylonContext,
>(
  options: AttachProteusSourceOptions,
): PylonMiddleware<C> =>
  async function attachProteusSourceMiddleware(ctx, next) {
    const actor = resolveActor(ctx, options.actor);
    lazyFactory(ctx, options.key, () =>
      options.source.session(buildProteusSessionOptions(ctx, actor)),
    );
    await next();
  };
