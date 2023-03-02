import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import {
  GetElevationRequestParams,
  GetElevationResponse,
  SessionStatus,
} from "@lindorm-io/common-types";

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

      client: {
        name: client.name,
        logoUri: client.logoUri,
        type: client.type,
        tenant: tenant.name,
      },

      elevationSession: {
        authenticationHint: elevationSession.authenticationHint,
        country: elevationSession.country,
        displayMode: elevationSession.displayMode,
        expires: elevationSession.expires.toISOString(),
        idTokenHint: elevationSession.idTokenHint,
        identityId: elevationSession.identityId,
        nonce: elevationSession.nonce,
        uiLocales: elevationSession.uiLocales,
      },
    },
  };
};
