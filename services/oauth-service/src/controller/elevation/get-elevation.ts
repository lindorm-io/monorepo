import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { expiryObject } from "@lindorm-io/expiry";
import {
  GetElevationRequestParams,
  GetElevationResponse,
  SessionStatuses,
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
    entity: { client, elevationSession },
  } = ctx;

  const { expires, expiresIn } = expiryObject(elevationSession.expires);

  return {
    body: {
      elevation: {
        isRequired: elevationSession.status === SessionStatuses.PENDING,
        minimumLevel: elevationSession.requestedAuthentication.minimumLevel,
        recommendedLevel: elevationSession.requestedAuthentication.recommendedLevel,
        recommendedMethods: elevationSession.requestedAuthentication.recommendedMethods,
        requiredLevel: elevationSession.requestedAuthentication.requiredLevel,
        requiredMethods: elevationSession.requestedAuthentication.requiredMethods,
      },

      client: {
        description: client.description,
        logoUri: client.logoUri,
        name: client.name,
        type: client.type,
      },

      elevationSession: {
        authenticationHint: elevationSession.authenticationHint,
        country: elevationSession.country,
        displayMode: elevationSession.displayMode,
        expiresAt: expires.toISOString(),
        expiresIn,
        idTokenHint: elevationSession.idTokenHint,
        identityId: elevationSession.identityId,
        nonce: elevationSession.nonce,
        uiLocales: elevationSession.uiLocales,
      },
    },
  };
};
