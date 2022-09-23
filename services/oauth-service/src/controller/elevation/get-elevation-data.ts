import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { GetElevationDataResponseBody, JOI_GUID } from "../../common";
import { ServerKoaController } from "../../types";
import { getExpires } from "@lindorm-io/core";

interface RequestData {
  id: string;
}

export const getElevationDataSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const getElevationDataController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<GetElevationDataResponseBody> => {
  const {
    entity: { elevationSession },
  } = ctx;

  const { expires, expiresIn } = getExpires(elevationSession.expires);

  return {
    body: {
      elevationStatus: elevationSession.status,
      elevationSession: {
        id: elevationSession.id,
        authenticationHint: elevationSession.authenticationHint,
        country: elevationSession.country,
        expiresAt: expires.toISOString(),
        expiresIn,
        identityId: elevationSession.identityId,
        nonce: elevationSession.nonce,
        uiLocales: elevationSession.uiLocales,
      },
      requested: {
        minimumLevel: elevationSession.requestedAuthentication.minimumLevel,
        recommendedLevel: elevationSession.requestedAuthentication.recommendedLevel,
        recommendedMethods: elevationSession.requestedAuthentication.recommendedMethods,
        requiredLevel: elevationSession.requestedAuthentication.requiredLevel,
        requiredMethods: elevationSession.requestedAuthentication.requiredMethods,
      },
    },
  };
};
