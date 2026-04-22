import type { IProteusSource } from "@lindorm/proteus";
import { lazyFactory } from "@lindorm/utils";
import { buildProteusSessionOptions } from "../../internal/utils/build-session-options.js";
import type { PylonContext, PylonMiddleware } from "../../types/index.js";

export type AttachProteusSourceOptions = {
  /** ctx key where the session will be exposed (e.g. "proteus", "analyticsProteus"). */
  key: string;
  /** The ProteusSource instance whose `session()` will be bound. */
  source: IProteusSource;
  /** Optional actor resolver — returns a string or null for unauthenticated/system calls. */
  actor?: (ctx: PylonContext) => string | null;
};

/**
 * Pylon middleware that lazily attaches a Proteus session to `ctx[options.key]`.
 * The session is only created on first read, receives the per-request logger
 * and hook metadata (with resolved `actor`), and forwards `ctx.signal` only
 * when the context is HTTP.
 */
export const createAttachProteusSourceMiddleware = <
  C extends PylonContext = PylonContext,
>(
  options: AttachProteusSourceOptions,
): PylonMiddleware<C> =>
  async function attachProteusSourceMiddleware(ctx, next) {
    const actor = options.actor?.(ctx) ?? null;
    lazyFactory(ctx, options.key, () =>
      options.source.session(buildProteusSessionOptions(ctx, actor)),
    );
    await next();
  };
