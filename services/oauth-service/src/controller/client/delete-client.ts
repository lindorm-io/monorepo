import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";

interface RequestData {
  id: string;
}

export const deleteClientSchema = Joi.object<RequestData>({
  id: Joi.string().required(),
});

export const deleteClientController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    cache: { clientCache },
    entity: { client },
    repository: { clientRepository },
  } = ctx;

  await clientRepository.destroy(client);
  await clientCache.destroy(client);
};
