import Joi from "joi";
import { ClientType, JOI_GUID } from "../../common";
import { ControllerResponse } from "@lindorm-io/koa";
import { LOGOUT_SESSION_COOKIE_NAME } from "../../constant";
import { LogoutSession } from "../../entity";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { confirmOauthLogoutSession, fetchOauthLogoutInfo } from "../../handler";
import { createURL } from "@lindorm-io/core";

interface RequestData {
  sessionId: string;
}

export const initialiseLogoutSchema = Joi.object<RequestData>({
  sessionId: JOI_GUID.required(),
});

export const initialiseLogoutController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { logoutSessionCache },
    data: { sessionId },
  } = ctx;

  const {
    client: { name, logoUri, description, type },
    logoutSession: { expiresAt },
  } = await fetchOauthLogoutInfo(ctx, sessionId);

  if (type === ClientType.CONFIDENTIAL) {
    const { redirectTo } = await confirmOauthLogoutSession(ctx, sessionId);

    return { redirect: redirectTo };
  }

  const logoutSession = await logoutSessionCache.create(
    new LogoutSession({
      description,
      expires: new Date(expiresAt),
      logoUri,
      name,
      oauthSessionId: sessionId,
      type,
    }),
  );

  ctx.setCookie(LOGOUT_SESSION_COOKIE_NAME, logoutSession.id, { expiry: logoutSession.expires });

  return {
    redirect: createURL(configuration.frontend.routes.logout, {
      host: configuration.frontend.host,
      port: configuration.frontend.port,
    }),
  };
};
