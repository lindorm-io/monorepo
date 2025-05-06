import { ServerError } from "@lindorm/errors";
import { isUrlLike } from "@lindorm/is";
import { PylonRouter } from "../../classes";
import { PylonHttpContext, PylonHttpOptions } from "../../types";

export const createWellKnownRouter = <C extends PylonHttpContext>(
  options: PylonHttpOptions<any>,
): PylonRouter<C> => {
  const router = new PylonRouter<C>();

  const openIdConfiguration = {
    ...(options.openIdConfiguration ?? {}),
    ...(options.issuer && { issuer: options.issuer }),
  };

  router.get("/change-password", async (ctx) => {
    if (!isUrlLike(options.changePasswordUri)) {
      throw new ServerError("Change password URI not configured");
    }
    ctx.redirect(options.changePasswordUri);
  });

  router.get("/jwks.json", async (ctx) => {
    ctx.body = ctx.amphora.jwks;
    ctx.status = 200;
  });

  router.get("/openid-configuration", async (ctx) => {
    ctx.body = openIdConfiguration;
    ctx.status = 200;
  });

  router.get("/pylon-configuration", async (ctx) => {
    ctx.body = {
      cors: options.cors,
      domain: options.domain,
      environment: options.environment,
      issuer: options.issuer,
      maxRequestAge: options.maxRequestAge,
      name: options.name,
      version: options.version,
    };
    ctx.status = 200;
  });

  return router;
};
