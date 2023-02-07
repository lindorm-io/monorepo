import Joi from "joi";
import { ClientAttributes } from "../../entity";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";

type RequestData = {
  id: string;
};

type ResponseBody = Partial<ClientAttributes>;

export const getClientInfoSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getClientInfoController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { client },
  } = ctx;

  return {
    body: {
      active: client.active,
      allowed: client.allowed,
      defaults: client.defaults,
      description: client.description,
      expiry: client.expiry,
      logoutUri: client.logoutUri,
      name: client.name,
      redirectUris: client.redirectUris,
      scopeDescriptions: client.scopeDescriptions,
      tenant: client.tenant,
      type: client.type,
    },
  };
};
