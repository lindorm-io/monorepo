import type { IIrisSource } from "@lindorm/iris";
import { lazyFactory } from "@lindorm/utils";
import { buildIrisSessionOptions } from "../../internal/utils/build-session-options.js";
import { resolveActor, type ActorResolver } from "../../internal/utils/resolve-actor.js";
import type { PylonContext, PylonMiddleware } from "../../types/index.js";

export type AttachIrisSourceOptions = {
  /** ctx key where the session will be exposed (e.g. "iris", "analyticsIris"). */
  key: string;
  /** The IrisSource instance whose `session()` will be bound. */
  source: IIrisSource;
  /** Optional actor resolver — returns a string or null for unauthenticated/system calls. */
  actor?: ActorResolver;
};

/**
 * Pylon middleware that lazily attaches an Iris session to `ctx[options.key]`.
 * The session is only created on first read and receives the per-request
 * logger and hook metadata (with resolved `actor`). Iris does not thread an
 * AbortSignal. The actor is resolved through `resolveActor` so all consumers
 * share a memoised `ctx.state.actor` value.
 */
export const createAttachIrisSourceMiddleware = <C extends PylonContext = PylonContext>(
  options: AttachIrisSourceOptions,
): PylonMiddleware<C> =>
  async function attachIrisSourceMiddleware(ctx, next) {
    const actor = resolveActor(ctx, options.actor);
    lazyFactory(ctx, options.key, () =>
      options.source.session(buildIrisSessionOptions(ctx, actor)),
    );
    await next();
  };
