import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";

type RequestData = {
  id: string;
};

export const deleteClientSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().required(),
  })
  .required();

export const deleteClientController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    entity: { client },
    mongo: { clientRepository },
  } = ctx;

  await clientRepository.destroy(client);
};
