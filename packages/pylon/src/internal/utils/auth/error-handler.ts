import { PylonHttpMiddleware } from "../../../types";

export const errorHandler: PylonHttpMiddleware = async (ctx) => {
  ctx.body = ctx.query;
  ctx.status = 500;
};
