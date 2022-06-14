import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { GetAuthenticationInfoResponseBody, JOI_GUID } from "../../common";
import { isAuthenticationRequired } from "../../util";
import { getExpires } from "@lindorm-io/core";

interface RequestData {
  id: string;
}

export const getAuthenticationInfoSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
});

export const getAuthenticationInfoController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<GetAuthenticationInfoResponseBody> => {
  const {
    entity: { authorizationSession, browserSession, client },
  } = ctx;

  const authenticationRequired = isAuthenticationRequired(authorizationSession, browserSession);

  const { expires, expiresIn } = getExpires(authorizationSession.expires);

  return {
    body: {
      authenticationRequired,
      authenticationStatus: authorizationSession.authenticationStatus,
      authorizationSession: {
        id: authorizationSession.id,
        displayMode: authorizationSession.displayMode,
        expiresAt: expires.toISOString(),
        expiresIn,
        identityId: authorizationSession.identityId,
        loginHint: authorizationSession.loginHint,
        originalUri: authorizationSession.originalUri,
        promptModes: authorizationSession.promptModes,
        uiLocales: authorizationSession.uiLocales,
      },
      browserSession: {
        amrValues: browserSession.amrValues,
        country: browserSession.country,
        identityId: browserSession.identityId,
        levelOfAssurance: browserSession.levelOfAssurance,
        remember: browserSession.remember,
      },
      client: {
        description: client.description,
        logoUri: client.logoUri,
        name: client.name,
        type: client.type,
      },
      requested: {
        authToken: authorizationSession.authToken,
        authenticationMethods: authorizationSession.authenticationMethods,
        country: authorizationSession.country,
        levelOfAssurance: authorizationSession.levelOfAssurance,
      },
    },
  };
};
