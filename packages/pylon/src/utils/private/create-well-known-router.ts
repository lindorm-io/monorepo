import { PylonRouter } from "../../classes";
import { OpenIdConfigurationOptions, PylonHttpContext } from "../../types";

type Options = {
  issuer?: string;
  openIdConfiguration?: Partial<OpenIdConfigurationOptions>;
};

export const createWellKnownRouter = <C extends PylonHttpContext>(
  options: Options,
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
