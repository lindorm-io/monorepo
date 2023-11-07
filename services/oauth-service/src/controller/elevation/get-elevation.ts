import {
  GetElevationSessionRequestParams,
  GetElevationSessionResponse,
  SessionStatus,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";
import { getAdjustedAccessLevel } from "../../util";

type RequestData = GetElevationSessionRequestParams;

type ResponseBody = GetElevationSessionResponse;

export const getElevationSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getElevationController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { client, elevationSession, tenant },
    mongo: { browserSessionRepository, clientSessionRepository },
  } = ctx;

  const browserSession = elevationSession.browserSessionId
    ? await browserSessionRepository.tryFind({ id: elevationSession.browserSessionId })
    : undefined;

  const clientSession = elevationSession.clientSessionId
    ? await clientSessionRepository.tryFind({ id: elevationSession.clientSessionId })
    : undefined;

  return {
    body: {
      elevation: {
        isRequired: elevationSession.status === SessionStatus.PENDING,
        status: elevationSession.status,

        factors: elevationSession.requestedAuthentication.factors,
        levelOfAssurance: elevationSession.requestedAuthentication.levelOfAssurance,
        methods: elevationSession.requestedAuthentication.methods,
        minimumLevelOfAssurance: elevationSession.requestedAuthentication.minimumLevelOfAssurance,
        strategies: elevationSession.requestedAuthentication.strategies,
      },

      elevationSession: {
        id: elevationSession.id,
        authenticationHint: elevationSession.authenticationHint,
        country: elevationSession.country,
        displayMode: elevationSession.displayMode,
        expires: elevationSession.expires.toISOString(),
        idTokenHint: elevationSession.idTokenHint,
        identityId: elevationSession.identityId,
        nonce: elevationSession.nonce,
        uiLocales: elevationSession.uiLocales,
      },

      browserSession: {
        id: browserSession?.id || null,
        adjustedAccessLevel: browserSession ? getAdjustedAccessLevel(browserSession) : 0,
        factors: browserSession?.factors || [],
        identityId: browserSession?.identityId || null,
        latestAuthentication: browserSession?.latestAuthentication.toISOString() || null,
        levelOfAssurance: browserSession?.levelOfAssurance || 0,
        methods: browserSession?.methods || [],
        remember: browserSession?.remember || false,
        singleSignOn: browserSession?.singleSignOn || false,
        strategies: browserSession?.strategies || [],
      },

      clientSession: {
        id: clientSession?.id || null,
        adjustedAccessLevel: clientSession ? getAdjustedAccessLevel(clientSession) : 0,
        audiences: clientSession?.audiences || [],
        factors: clientSession?.factors || [],
        identityId: clientSession?.identityId || null,
        latestAuthentication: clientSession?.latestAuthentication.toISOString() || null,
        levelOfAssurance: clientSession?.levelOfAssurance || 0,
        methods: clientSession?.methods || [],
        scopes: clientSession?.scopes || [],
        strategies: clientSession?.strategies || [],
      },

      client: {
        id: client.id,
        name: client.name,
        logoUri: client.logoUri,
        singleSignOn: client.singleSignOn,
        type: client.type,
      },

      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
    },
  };
};
