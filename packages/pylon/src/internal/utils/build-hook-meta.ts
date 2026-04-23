import type { IrisHookMeta } from "@lindorm/iris";
import type { ProteusHookMeta } from "@lindorm/proteus";

/**
 * Build framework-agnostic hook metadata from a Koa-like Pylon context. The
 * returned shape is structurally compatible with both `ProteusHookMeta` and
 * `IrisHookMeta`, so callers can feed the same object to `proteus.session()`
 * and `iris.session()` without bridging types.
 *
 * Tolerates socket/handshake/http contexts by defaulting missing fields:
 * - `correlationId` falls back to `"unknown"` when no `state.metadata` exists
 * - `timestamp` falls back to a fresh `Date` at call time
 * - `actor` is supplied by the caller (resolved once per request upstream)
 */
export const buildHookMeta = (
  ctx: any,
  actor: string,
): ProteusHookMeta & IrisHookMeta => ({
  correlationId: ctx?.state?.metadata?.correlationId ?? "unknown",
  actor,
  timestamp: ctx?.state?.metadata?.date ?? new Date(),
});
