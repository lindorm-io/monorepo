import { KeySetExportKeys } from "@lindorm-io/jwk";
import { HttpStatus } from "@lindorm-io/koa";
import Router from "koa-router";
import { LindormNodeServerContext, LindormNodeServerKoaContext } from "../types";

export const createWellKnownJwksRouter = <
  Context extends LindormNodeServerContext = LindormNodeServerContext,
>(
  exportKeys: KeySetExportKeys = "public",
  exportExternalKeys: boolean = false,
): Router<Context> => {
  const router = new Router<Context, any>();

  router.get("/", async (ctx: LindormNodeServerKoaContext): Promise<void> => {
    ctx.body = { keys: ctx.keystore.getJwks(exportKeys, exportExternalKeys) };
    ctx.status = HttpStatus.Success.OK;
  });

  return router;
};
