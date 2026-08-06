import {
  Conduit,
  conduitChangeRequestBodyMiddleware,
  conduitChangeRequestQueryMiddleware,
  conduitCorrelationMiddleware,
} from "@lindorm/conduit";
import type { PylonAuthDriverContext, PylonContext } from "../../../types/index.js";

/**
 * Build the narrow read-only context handed to the auth driver.
 *
 * The conduit is correlation-tagged for this request and snake-cases outbound
 * parameter names, at depth 1: every request an auth driver sends is a flat
 * parameter list except RFC 9396 §2 `authorization_details`, whose entries carry
 * fields defined by the schema named in `type` and must reach the wire verbatim.
 *
 * ⚠ NO response-side case middleware is installed here, deliberately. The same
 * conduit carries the token endpoint (where `authorization_details` must survive
 * unconverted) and userinfo (where nested conversion IS wanted), so only a call
 * that knows its own payload can pin the depth — and that call is the driver's.
 */
export const createAuthDriverContext = (ctx: PylonContext): PylonAuthDriverContext => ({
  amphora: ctx.amphora,
  conduit: new Conduit({
    alias: "auth",
    environment: ctx.state.app.environment,
    logger: ctx.logger,
    middleware: [
      conduitCorrelationMiddleware(ctx.state.metadata.correlationId),
      conduitChangeRequestBodyMiddleware("snake", { depth: 1 }),
      conduitChangeRequestQueryMiddleware(),
    ],
  }),
  environment: ctx.state.app.environment,
  logger: ctx.logger,
});
