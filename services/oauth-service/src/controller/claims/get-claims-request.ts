import { GetClaimsSessionRequestParams, GetClaimsSessionResponse } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
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
      claimsSession: {
        id: claimsSession.id,
        adjustedAccessLevel: getAdjustedAccessLevel(claimsSession),
        audiences: claimsSession.audiences,
        expires: claimsSession.expires.toISOString(),
        factors: claimsSession.factors,
        identityId: claimsSession.identityId,
        latestAuthentication: claimsSession.latestAuthentication.toISOString(),
        levelOfAssurance: claimsSession.levelOfAssurance,
        metadata: claimsSession.metadata,
        methods: claimsSession.methods,
        scopes: claimsSession.scopes,
        strategies: claimsSession.strategies,
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
