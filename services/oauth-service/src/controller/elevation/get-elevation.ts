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
    entity: { client, elevationRequest, tenant },
  } = ctx;

  return {
    body: {
      elevation: {
        isRequired: elevationRequest.status === SessionStatus.PENDING,
        status: elevationRequest.status,

        minimumLevel: elevationRequest.requestedAuthentication.minimumLevel,
        recommendedLevel: elevationRequest.requestedAuthentication.recommendedLevel,
        recommendedMethods: elevationRequest.requestedAuthentication.recommendedMethods,
        requiredLevel: elevationRequest.requestedAuthentication.requiredLevel,
        requiredMethods: elevationRequest.requestedAuthentication.requiredMethods,
      },

      elevationRequest: {
        id: elevationRequest.id,
        authenticationHint: elevationRequest.authenticationHint,
        country: elevationRequest.country,
        displayMode: elevationRequest.displayMode,
        expires: elevationRequest.expires.toISOString(),
        idTokenHint: elevationRequest.idTokenHint,
        identityId: elevationRequest.identityId,
        nonce: elevationRequest.nonce,
        uiLocales: elevationRequest.uiLocales,
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
