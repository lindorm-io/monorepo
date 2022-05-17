import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { FlowType } from "../../enum";
import { JOI_GUID, SessionStatus } from "../../common";
import { LOGIN_SESSION_COOKIE_NAME } from "../../constant";
import { ServerKoaController } from "../../types";
import { assertPKCE, createURL } from "@lindorm-io/core";
import { configuration } from "../../server/configuration";
import { filter, includes } from "lodash";
import { isAuthenticationReadyToConfirm } from "../../util";
import { randomUUID } from "crypto";
import {
  oauthConfirmAuthentication,
  oauthGetAuthenticationInfo,
  oauthSkipAuthentication,
} from "../../handler";

interface RequestData {
  sessionId: string;
}

export const oauthLoginSchema = Joi.object<RequestData>({
  sessionId: JOI_GUID.required(),
});

export const oauthLoginController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { loginSessionCache },
    data: { sessionId },
  } = ctx;

  const {
    authenticationRequired,
    authenticationStatus,
    authorizationSession: { displayMode, expiresAt, expiresIn, identityId, loginHint, uiLocales },
    requested: { authenticationId, authenticationMethods, country, levelOfAssurance, pkceVerifier },
  } = await oauthGetAuthenticationInfo(ctx, sessionId);

  if (!authenticationRequired) {
    const { redirectTo } = await oauthSkipAuthentication(ctx, sessionId);
    return { redirect: redirectTo };
  }

  if (authenticationStatus !== SessionStatus.PENDING) {
    throw new ClientError("Invalid Session Status");
  }

  const loginSessionId = authenticationId || randomUUID();

  let loginSession = await loginSessionCache.findOrCreate({ id: loginSessionId });

  loginSession.country = loginSession.country || country;
  loginSession.expires = new Date(expiresAt);
  loginSession.identityId = loginSession.identityId || identityId;
  loginSession.loginHint = loginSession.loginHint || loginHint;
  loginSession.oauthSessionId = sessionId;
  loginSession.requestedAuthenticationMethods = filter(authenticationMethods, (key) =>
    includes(Object.values(FlowType), key),
  );
  loginSession.requestedLevelOfAssurance = levelOfAssurance;

  loginSession = await loginSessionCache.update(loginSession, expiresIn);

  if (
    isAuthenticationReadyToConfirm(loginSession) &&
    loginSession.pkceChallenge &&
    loginSession.pkceMethod &&
    pkceVerifier
  ) {
    await assertPKCE(loginSession.pkceChallenge, loginSession.pkceMethod, pkceVerifier);

    const { redirectTo } = await oauthConfirmAuthentication(ctx, loginSession);
    return { redirect: redirectTo };
  }

  ctx.setCookie(LOGIN_SESSION_COOKIE_NAME, loginSession.id, { expiry: loginSession.expires });

  return {
    redirect: createURL(configuration.frontend.routes.login, {
      host: configuration.frontend.host,
      port: configuration.frontend.port,
      query: { displayMode, uiLocales },
    }),
  };
};
