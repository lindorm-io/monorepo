import { GetClaimsRequestRequestParams, GetClaimsRequestResponse } from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";
import { getAdjustedAccessLevel } from "../../util";

type RequestData = GetClaimsRequestRequestParams;

type ResponseBody = GetClaimsRequestResponse;

export const getClaimsRequestSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getClaimsRequestController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { claimsRequest, client, tenant },
  } = ctx;

  return {
    body: {
      claimsRequest: {
        id: claimsRequest.id,
        adjustedAccessLevel: getAdjustedAccessLevel(claimsRequest),
        audiences: claimsRequest.audiences,
        expires: claimsRequest.expires.toISOString(),
        identityId: claimsRequest.identityId,
        latestAuthentication: claimsRequest.latestAuthentication.toISOString(),
        levelOfAssurance: claimsRequest.levelOfAssurance,
        metadata: claimsRequest.metadata,
        methods: claimsRequest.methods,
        scopes: claimsRequest.scopes,
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
