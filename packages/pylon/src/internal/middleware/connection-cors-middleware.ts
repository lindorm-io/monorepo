import { CorsOptions, PylonConnectionMiddleware } from "../../types";
import { assertAllowedOrigin } from "../utils/cors/assert-allowed-origin";
import { validateCorsOptions } from "../utils/cors/validate-cors-options";

export const createConnectionCorsMiddleware = (
  options: CorsOptions = {},
): PylonConnectionMiddleware => {
  validateCorsOptions(options);

  return async function connectionCorsMiddleware(ctx, next) {
    const origin = ctx.io.socket.handshake?.headers?.origin;

    assertAllowedOrigin(origin, options.allowOrigins);

    await next();
  };
};
