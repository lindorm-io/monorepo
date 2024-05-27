import { PylonRouter } from "../../classes";
import { PylonHttpContext, PylonOptions } from "../../types";

export const createWellKnownRouter = <C extends PylonHttpContext>(
  options: PylonOptions<C, any>,
): PylonRouter<C> => {
  const router = new PylonRouter<C>();

  const openIdConfiguration = {
    ...(options.openIdConfiguration ?? {}),
    issuer: options.issuer,
  };

  router.get("/jwks.json", async (ctx) => {
    ctx.body = ctx.amphora.jwks;
    ctx.status = 200;
  });

  router.get("/openid-configuration", async (ctx) => {
    ctx.body = openIdConfiguration;
    ctx.status = 200;
  });

  return router;
};
