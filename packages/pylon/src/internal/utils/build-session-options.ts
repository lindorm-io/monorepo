import type { SessionOptions as IrisSessionOptions } from "@lindorm/iris";
import type { SessionOptions as ProteusSessionOptions } from "@lindorm/proteus";
import type { PylonCommonContext } from "../../types/index.js";
import { buildHookMeta } from "./build-hook-meta.js";
import { isHttpContext } from "./is-context.js";

/**
 * Build `proteus.session()` options from a pylon context. Attaches the
 * context's logger, hook metadata (with resolved `actor`), and forwards
 * `ctx.signal` only when the context is HTTP. Socket/handshake contexts
 * receive `signal: undefined` since they have no per-request abort signal.
 */
export const buildProteusSessionOptions = (
  ctx: PylonCommonContext,
  actor: string | null,
): ProteusSessionOptions => ({
  logger: ctx.logger,
  meta: buildHookMeta(ctx, actor),
  signal: isHttpContext(ctx) ? ctx.signal : undefined,
});

/**
 * Build `iris.session()` options from a pylon context. Iris does not thread
 * an `AbortSignal`, so only `logger` and hook metadata are supplied.
 */
export const buildIrisSessionOptions = (
  ctx: PylonCommonContext,
  actor: string | null,
): IrisSessionOptions => ({
  logger: ctx.logger,
  meta: buildHookMeta(ctx, actor),
});
