import Router from "koa-router";
import { LindormNodeServerContext } from "../types";
import { HttpStatus } from "@lindorm-io/koa";

export const createWellKnownJwksRouter = <
  Context extends LindormNodeServerContext = LindormNodeServerContext,
>(
  exposeExternal: boolean,
): Router => {
  const router = new Router<unknown, Context>();

  router.get("/", async (ctx): Promise<void> => {
    ctx.body = { keys: ctx.keystore.getJWKS({ exposeExternal }) };
    ctx.status = HttpStatus.Success.OK;
  });

  return router;
};
