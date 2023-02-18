import Joi from "joi";
import { ClientAttributes } from "../../entity";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";

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
      backChannelLogoutUri: client.backChannelLogoutUri,
      defaults: client.defaults,
      description: client.description,
      expiry: client.expiry,
      name: client.name,
      postLogoutUris: client.postLogoutUris,
      redirectUris: client.redirectUris,
      scopeDescriptions: client.scopeDescriptions,
      tenantId: client.tenantId,
      type: client.type,
    },
  };
};
