import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { createURL } from "@lindorm-io/core";
import { initialiseOidcSession } from "../../handler";

interface RequestData {
  provider: string;
  remember: boolean;
}

export const initialiseLoginOidcSchema = Joi.object<RequestData>({
  provider: Joi.string().required(),
  remember: Joi.boolean().required(),
});

export const initialiseLoginOidcController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { loginSessionCache },
    data: { provider, remember },
    entity: { loginSession },
  } = ctx;

  loginSession.remember = remember;

  await loginSessionCache.update(loginSession);

  const { redirectTo } = await initialiseOidcSession(ctx, {
    callbackUri: createURL("/sessions/login/oidc/callback", {
      host: configuration.server.host,
      port: configuration.server.port,
    }).toString(),
    expiresAt: loginSession.expires.toISOString(),
    provider,
  });

  return { redirect: redirectTo };
};
