import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";

interface RequestData {
  id: string;
  permissions: Array<string>;
}

export const updateClientPermissionsSchema = Joi.object<RequestData>({
  id: Joi.string().required(),
  permissions: Joi.array().items(Joi.string()).required(),
});

export const updateClientPermissionsController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { clientCache },
    data: { permissions },
    entity: { client },
    repository: { clientRepository },
  } = ctx;

  client.permissions = permissions;

  const updated = await clientRepository.update(client);
  await clientCache.update(updated);

  return {
    body: {},
  };
};
