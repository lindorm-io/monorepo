import { PylonHttpMiddleware } from "../../../types";

export const errorHandler: PylonHttpMiddleware = async (ctx) => {
  ctx.body = {
    error: ctx.query.error ?? "unknown_error",
    error_description: ctx.query.error_description ?? null,
    state: ctx.query.state ?? null,
  };
  ctx.status = 400;
};
