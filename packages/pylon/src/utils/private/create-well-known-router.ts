import { ClientError, ServerError } from "@lindorm/errors";
import { isString, isUrlLike } from "@lindorm/is";
import { removeUndefined, sortKeys } from "@lindorm/utils";
import { PylonRouter } from "../../classes";
import { PylonHttpContext, PylonHttpOptions } from "../../types";

export const createWellKnownRouter = <C extends PylonHttpContext>(
  options: PylonHttpOptions<C>,
): PylonRouter<C> => {
  const router = new PylonRouter<C>();

  const openIdConfiguration = sortKeys(
    removeUndefined({
      ...(options.openIdConfiguration ?? {}),
      ...(options.domain && { issuer: options.domain }),
    }),
  );

  if (options.domain) {
    for (const [key, value] of Object.entries(openIdConfiguration)) {
      if (isString(value) && value.includes("<DOMAIN>")) {
        (openIdConfiguration as any)[key] = value.replace("<DOMAIN>", options.domain);
        continue;
      }
    }
  }

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
    const result = { ...openIdConfiguration };

    for (const [key, value] of Object.entries(result)) {
      if (isString(value) && value.includes("<ORIGIN>")) {
        (result as any)[key] = value.replace("<ORIGIN>", ctx.request.origin);
        continue;
      }
    }

    ctx.body = openIdConfiguration;
    ctx.status = 200;
  });

  router.get("/pylon-configuration", async (ctx) => {
    ctx.body = {
      cors: options.cors,
      domain: options.domain,
      environment: options.environment,
      maxRequestAge: options.maxRequestAge,
      name: options.name,
      version: options.version,
    };
    ctx.status = 200;
  });

  router.get("/right-to-be-forgotten", async (ctx) => {
    if (ctx.state.authorization.type !== "bearer") {
      throw new ClientError("Unauthorized", {
        code: "unauthorized",
        details: "Right to be forgotten requires Bearer authorization",
        status: ClientError.Status.Unauthorized,
      });
    }

    if (options.callbacks?.rightToBeForgotten) {
      await options.callbacks.rightToBeForgotten(ctx);
    }

    ctx.body = undefined;
    ctx.status = 204;
  });

  return router;
};
