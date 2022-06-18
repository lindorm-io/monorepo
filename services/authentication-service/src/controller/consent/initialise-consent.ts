import Joi from "joi";
import { CONSENT_SESSION_COOKIE_NAME } from "../../constant";
import { ClientError } from "@lindorm-io/errors";
import { ClientType, JOI_GUID, SessionStatus } from "../../common";
import { ConsentSession } from "../../entity";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { configuration } from "../../server/configuration";
import { createURL } from "@lindorm-io/core";
import {
  confirmOauthConsentSession,
  fetchOauthConsentInfo,
  skipOauthConsentSession,
} from "../../handler";

interface RequestData {
  sessionId: string;
}

export const initialiseConsentSchema = Joi.object<RequestData>({
  sessionId: JOI_GUID.required(),
});

export const initialiseConsentController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { consentSessionCache },
    data: { sessionId },
  } = ctx;

  const {
    authorizationSession: { displayMode, expiresAt, uiLocales },
    client: { scopeDescriptions, description, name, requiredScopes, type, logoUri },
    consentRequired,
    consentStatus,
    requested: { audiences, scopes },
  } = await fetchOauthConsentInfo(ctx, sessionId);

  if (consentStatus !== SessionStatus.PENDING) {
    throw new ClientError("Invalid Session Status");
  }

  if (!consentRequired) {
    const { redirectTo } = await skipOauthConsentSession(ctx, sessionId);

    return { redirect: redirectTo };
  }

  if (type === ClientType.CONFIDENTIAL) {
    const { redirectTo } = await confirmOauthConsentSession(ctx, sessionId, {
      audiences,
      scopes,
    });

    return { redirect: redirectTo };
  }

  const consentSession = await consentSessionCache.create(
    new ConsentSession({
      description,
      expires: new Date(expiresAt),
      logoUri,
      name,
      oauthSessionId: sessionId,
      requestedAudiences: audiences,
      requestedScopes: scopes,
      requiredScopes,
      scopeDescriptions,
      type,
    }),
  );

  ctx.setCookie(CONSENT_SESSION_COOKIE_NAME, consentSession.id, { expiry: consentSession.expires });

  return {
    redirect: createURL(configuration.frontend.routes.consent, {
      host: configuration.frontend.host,
      port: configuration.frontend.port,
      query: { displayMode, uiLocales },
    }),
  };
};
