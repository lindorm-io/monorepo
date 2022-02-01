import Joi from "joi";
import { ClientAttributes } from "../../entity";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";

interface RequestData {
  id: string;
}

type ResponseBody = Partial<ClientAttributes>;

export const getClientInfoSchema = Joi.object<RequestData>({
  id: Joi.string().required(),
});

export const getClientInfoController: Controller<Context<RequestData>> = async (
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
      owners: client.owners,
      permissions: client.permissions,
      redirectUri: client.redirectUri,
      scopeDescriptions: client.scopeDescriptions,
      type: client.type,
    },
  };
};
