import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";

interface RequestData {
  id: string;
}

export const approveClientSchema = Joi.object<RequestData>({
  id: Joi.string().required(),
});

export const approveClientController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { clientCache },
    entity: { client },
    repository: { clientRepository },
  } = ctx;

  client.active = true;

  const updated = await clientRepository.update(client);
  await clientCache.update(updated);

  return {
    body: {},
  };
};
