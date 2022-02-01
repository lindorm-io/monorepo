import Joi from "joi";
import { ClientType, JOI_CLIENT_TYPE } from "../../common";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";

interface RequestData {
  id: string;
  type: ClientType;
}

export const updateClientTypeSchema = Joi.object<RequestData>({
  id: Joi.string().required(),
  type: JOI_CLIENT_TYPE.required(),
});

export const updateClientTypeController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { clientCache },
    data: { type },
    entity: { client },
    repository: { clientRepository },
  } = ctx;

  client.type = type;

  const updated = await clientRepository.update(client);
  await clientCache.update(updated);

  return {
    body: {},
  };
};
