import {
  GetAuthenticationTokenSessionRequestParams,
  GetAuthenticationTokenSessionResponse,
} from "@lindorm-io/common-types";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";

type RequestData = GetAuthenticationTokenSessionRequestParams;

type ResponseBody = GetAuthenticationTokenSessionResponse;

export const getAuthenticationTokenSessionSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getAuthenticationTokenSessionController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { authenticationTokenSession, client, tenant },
  } = ctx;

  return {
    body: {
      authenticationTokenSession: {
        id: authenticationTokenSession.id,
        audiences: authenticationTokenSession.audiences,
        expires: authenticationTokenSession.expires.toISOString(),
        metadata: authenticationTokenSession.metadata,
        scopes: authenticationTokenSession.scopes,
        token: authenticationTokenSession.token,
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
