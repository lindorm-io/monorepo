import { ClientError } from "@lindorm/errors";
import { isString, isUrlLike } from "@lindorm/is";
import { OpenIdConfiguration } from "@lindorm/types";
import { removeUndefined, sortKeys } from "@lindorm/utils";
import { PylonRouter } from "../../classes";
import { PylonHttpContext, PylonHttpOptions } from "../../types";
import { assertSecurityTxtOptions } from "./assert-security-txt-options";
import { renderSecurityTxt } from "./render-security-txt";

export const createWellKnownRouter = <C extends PylonHttpContext>(
  options: PylonHttpOptions<C>,
): PylonRouter<C> => {
  const router = new PylonRouter<C>();

  router.get("/change-password", async (ctx) => {
    if (!isUrlLike(options.changePasswordUri)) {
      throw new ClientError("Change password URI not configured", {
        status: ClientError.Status.NotFound,
      });
    }
    ctx.redirect(options.changePasswordUri);
  });

  router.get("/jwks.json", async (ctx) => {
    ctx.body = ctx.amphora.jwks;
    ctx.status = 200;
  });

  router.get("/oauth-protected-resource", async (ctx) => {
    if (!isUrlLike(options.auth?.issuer)) {
      throw new ClientError("Change password URI not configured", {
        status: ClientError.Status.NotFound,
      });
    }
    ctx.body = [options.auth.issuer];
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

  if (options.securityTxt) {
    assertSecurityTxtOptions(options.securityTxt);

    const body = renderSecurityTxt(options.securityTxt);

    router.get("/security.txt", async (ctx) => {
      ctx.type = "text/plain; charset=utf-8";
      ctx.body = body;
      ctx.status = 200;
    });
  }

  if (options.openIdConfiguration) {
    const openIdConfiguration = sortKeys(
      removeUndefined({
        ...(options.domain && { issuer: options.domain }),
        ...options.openIdConfiguration,
      }),
    );

    const getOpenIdConfig = (ctx: C): Partial<OpenIdConfiguration> => {
      const result = { ...openIdConfiguration };

      for (const [key, value] of Object.entries(result)) {
        if (isString(value) && value.includes("<DOMAIN>")) {
          (result as any)[key] = value.replace("<DOMAIN>", ctx.state.app.domain);
          continue;
        }
      }

      for (const [key, value] of Object.entries(result)) {
        if (isString(value) && value.includes("<ORIGIN>")) {
          (result as any)[key] = value.replace("<ORIGIN>", ctx.state.origin);
          continue;
        }
      }

      return result;
    };

    router.get("/oauth-authorization-server", async (ctx) => {
      ctx.body = getOpenIdConfig(ctx);
      ctx.status = 200;
    });

    router.get("/openid-configuration", async (ctx) => {
      ctx.body = getOpenIdConfig(ctx);
      ctx.status = 200;
    });
  }

  return router;
};
