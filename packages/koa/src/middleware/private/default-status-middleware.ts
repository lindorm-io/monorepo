import { HttpStatus } from "../../constant";
import { Middleware } from "../../types";

export const defaultStatusMiddleware: Middleware = async (ctx, next): Promise<void> => {
  ctx.body = {};
  ctx.status = HttpStatus.ClientError.NOT_FOUND;

  await next();
};
