import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";

interface RequestData {
  id: string;
}

export const deleteClientSchema = Joi.object<RequestData>({
  id: Joi.string().required(),
});

export const deleteClientController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { clientCache },
    entity: { client },
    repository: { clientRepository },
  } = ctx;

  await clientRepository.destroy(client);
  await clientCache.destroy(client);

  return {
    body: {},
  };
};
