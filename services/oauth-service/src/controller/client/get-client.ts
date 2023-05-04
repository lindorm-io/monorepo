import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ClientAttributes } from "../../entity";
import { ServerKoaController } from "../../types";

type RequestData = {
  id: string;
};

type ResponseBody = Partial<ClientAttributes>;

export const getClientSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getClientController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { client },
  } = ctx;

  return {
    body: {
      active: client.active,
      allowed: client.allowed,
      audiences: client.audiences,
      backChannelLogoutUri: client.backChannelLogoutUri,
      defaults: client.defaults,
      description: client.description,
      enforceBasicAuth: client.enforceBasicAuth,
      enforceSecret: client.enforceSecret,
      expiry: client.expiry,
      frontChannelLogoutUri: client.frontChannelLogoutUri,
      host: client.host,
      logoUri: client.logoUri,
      name: client.name,
      postLogoutUris: client.postLogoutUris,
      redirectUris: client.redirectUris,
      requiredScopes: client.requiredScopes,
      rtbfUri: client.rtbfUri,
      scopeDescriptions: client.scopeDescriptions,
      singleSignOn: client.singleSignOn,
      tenantId: client.tenantId,
      type: client.type,
    },
  };
};
