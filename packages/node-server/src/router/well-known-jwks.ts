import { HttpStatus } from "@lindorm-io/koa";
import Router from "koa-router";
import { LindormNodeServerContext } from "../types";

export const createWellKnownJwksRouter = <
  Context extends LindormNodeServerContext = LindormNodeServerContext,
>(
  exposeExternal = false,
): Router<Context> => {
  const router = new Router<Context, any>();

  router.get("/", async (ctx): Promise<void> => {
    ctx.body = { keys: ctx.keystore.getJWKS({ exposeExternal }) };
    ctx.status = HttpStatus.Success.OK;
  });

  return router;
};
