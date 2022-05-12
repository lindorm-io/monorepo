import Router from "koa-router";
import { HeartbeatCallback, KoaContext } from "../types";
import { HttpStatus } from "../constant";

export const createHeartbeatRouter = <Context extends KoaContext>(
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
