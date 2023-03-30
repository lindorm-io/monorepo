import Router from "koa-router";
import { LindormNodeServerContext } from "../types";
import { HttpStatus } from "@lindorm-io/koa";

export const createWellKnownJwksRouter = <
  Context extends LindormNodeServerContext = LindormNodeServerContext,
>(
  exposeExternal = false,
): Router => {
  const router = new Router<unknown, any>();

  router.get("/", async (ctx): Promise<void> => {
    ctx.body = { keys: ctx.keystore.getJWKS({ exposeExternal }) };
    ctx.status = HttpStatus.Success.OK;
  });

  return router;
};
