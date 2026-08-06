import type { ConduitMiddleware } from "../../types/index.js";

/**
 * Derives the wire headers from request metadata. Metadata is the model; these
 * headers are a view of it, written in exactly one place.
 *
 * ⚠ Ordering is load-bearing: this runs AFTER user middleware, so it reads the
 * FINAL metadata. `conduitCorrelationMiddleware` and `conduitSessionMiddleware`
 * only write metadata, and when this ran first it copied the freshly generated
 * placeholder id by value — so the upstream service received an unrelated
 * correlation id while our own logs, which read metadata, looked correct.
 * Anything that sets metadata is forwarded for free; move this earlier and it
 * silently stops being true.
 */
export const defaultHeaders: ConduitMiddleware = async (ctx, next) => {
  ctx.req.headers["Date"] = new Date().toUTCString();
  ctx.req.headers["X-Correlation-Id"] = ctx.req.metadata.correlationId;
  ctx.req.headers["X-Request-Id"] = ctx.req.metadata.requestId;

  if (ctx.req.metadata.sessionId) {
    ctx.req.headers["X-Session-Id"] = ctx.req.metadata.sessionId;
  }

  if (ctx.app.environment) {
    ctx.req.headers["X-Environment"] = ctx.app.environment;
  }

  await next();
};
