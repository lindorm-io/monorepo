import { HttpStatus } from "../../constant";
import { DefaultLindormMiddleware } from "../../types";

export const defaultStatusMiddleware: DefaultLindormMiddleware = async (
  ctx,
  next,
): Promise<void> => {
  ctx.body = {};
  ctx.status = HttpStatus.ClientError.NOT_FOUND;

  await next();
};
