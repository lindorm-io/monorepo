import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";

type RequestData = {
  id: string;
  active: boolean;
  name: string;
};

export const updateClientSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    active: Joi.boolean(),
    name: Joi.string().allow(null),
  })
  .required();

export const updateClientController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { active, name },
    entity: { client },
    mongo: { clientRepository },
  } = ctx;

  if (active !== undefined) {
    client.active = active;
  }

  if (name !== undefined) {
    client.name = name;
  }

  await clientRepository.update(client);
};
