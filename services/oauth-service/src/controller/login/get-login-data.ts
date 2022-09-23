import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { GetLoginDataResponseBody, JOI_GUID } from "../../common";
import { ServerKoaController } from "../../types";
import { getExpires } from "@lindorm-io/core";
import { isLoginRequired } from "../../util";

interface RequestData {
  id: string;
}

export const getLoginDataSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const getLoginDataController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<GetLoginDataResponseBody> => {
  const {
    entity: { authorizationSession, client },
    repository: { browserSessionRepository },
  } = ctx;

  const browserSession = authorizationSession.identifiers.browserSessionId
    ? await browserSessionRepository.find({ id: authorizationSession.identifiers.browserSessionId })
    : undefined;

  const loginRequired = isLoginRequired(authorizationSession, browserSession);

  const { expires, expiresIn } = getExpires(authorizationSession.expires);

  return {
    body: {
      loginRequired,
      loginStatus: authorizationSession.status.login,
      authorizationSession: {
        id: authorizationSession.id,
        authToken: authorizationSession.authToken,
        country: authorizationSession.country,
        displayMode: authorizationSession.displayMode,
        expiresAt: expires.toISOString(),
        expiresIn,
        loginHint: authorizationSession.loginHint,
        nonce: authorizationSession.nonce,
        originalUri: authorizationSession.originalUri,
        promptModes: authorizationSession.promptModes,
        uiLocales: authorizationSession.uiLocales,
      },
      browserSession: {
        amrValues: browserSession?.amrValues || [],
        country: browserSession?.country || null,
        identityId: browserSession?.identityId || null,
        levelOfAssurance: browserSession?.levelOfAssurance || 0,
        remember: browserSession?.remember || false,
      },
      client: {
        description: client.description,
        logoUri: client.logoUri,
        name: client.name,
        type: client.type,
      },
      requested: {
        identityId: authorizationSession.requestedLogin.identityId,
        minimumLevel: authorizationSession.requestedLogin.minimumLevel,
        recommendedLevel: authorizationSession.requestedLogin.recommendedLevel,
        recommendedMethods: authorizationSession.requestedLogin.recommendedMethods,
        requiredLevel: authorizationSession.requestedLogin.requiredLevel,
        requiredMethods: authorizationSession.requestedLogin.requiredMethods,
      },
    },
  };
};
