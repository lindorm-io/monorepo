import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { GetClaimsSessionRequestParams, GetClaimsSessionResponse } from "@lindorm-io/common-types";
import { ServerKoaController } from "../../types";
import { getAdjustedAccessLevel } from "../../util";

type RequestData = GetClaimsSessionRequestParams;

type ResponseBody = GetClaimsSessionResponse;

export const getClaimsSessionSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getClaimsSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { claimsSession, client, tenant },
  } = ctx;

  return {
    body: {
      adjustedAccessLevel: getAdjustedAccessLevel(claimsSession),
      audiences: claimsSession.audiences,
      expires: claimsSession.expires.toISOString(),
      identityId: claimsSession.identityId,
      latestAuthentication: claimsSession.latestAuthentication.toISOString(),
      levelOfAssurance: claimsSession.levelOfAssurance,
      metadata: claimsSession.metadata,
      methods: claimsSession.methods,
      scopes: claimsSession.scopes,

      client: {
        name: client.name,
        logoUri: client.logoUri,
        type: client.type,
        tenant: tenant.name,
      },
    },
  };
};
