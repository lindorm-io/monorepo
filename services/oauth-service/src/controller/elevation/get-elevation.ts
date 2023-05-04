import {
  GetElevationRequestParams,
  GetElevationResponse,
  SessionStatus,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";

type RequestData = GetElevationRequestParams;

type ResponseBody = GetElevationResponse;

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
  } = ctx;

  return {
    body: {
      elevation: {
        isRequired: elevationSession.status === SessionStatus.PENDING,
        status: elevationSession.status,

        minimumLevel: elevationSession.requestedAuthentication.minimumLevel,
        recommendedLevel: elevationSession.requestedAuthentication.recommendedLevel,
        recommendedMethods: elevationSession.requestedAuthentication.recommendedMethods,
        requiredLevel: elevationSession.requestedAuthentication.requiredLevel,
        requiredMethods: elevationSession.requestedAuthentication.requiredMethods,
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
