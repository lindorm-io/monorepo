import Router from "koa-router";
import { HealthCallback, KoaContext } from "../types";
import { HttpStatus } from "../constant";

export const createHealthRouter = <Context extends KoaContext>(
  callback?: HealthCallback<Context>,
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
