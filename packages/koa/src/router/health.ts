import Router from "koa-router";
import { DefaultLindormKoaContext, HealthCallback } from "../types";
import { HttpStatus } from "../constant";

export const createHealthRouter = <
  Context extends DefaultLindormKoaContext = DefaultLindormKoaContext,
>(
  callback?: HealthCallback<Context>,
): Router => {
  const router = new Router<unknown, any>();

  router.get("/", async (ctx): Promise<void> => {
    if (callback) {
      await callback(ctx);
    }
    ctx.body = {};
    ctx.status = HttpStatus.Success.OK;
  });

  return router;
};
