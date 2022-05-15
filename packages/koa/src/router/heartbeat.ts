import Router from "koa-router";
import { DefaultLindormKoaContext, HeartbeatCallback } from "../types";
import { HttpStatus } from "../constant";

export const createHeartbeatRouter = <
  Context extends DefaultLindormKoaContext = DefaultLindormKoaContext,
>(
  callback?: HeartbeatCallback<Context>,
): Router => {
  const router = new Router<unknown, Context>();

  router.get("/", async (ctx): Promise<void> => {
    if (callback) {
      await callback(ctx);
    }
    ctx.body = {};
    ctx.status = HttpStatus.Success.OK;
  });

  return router;
};
