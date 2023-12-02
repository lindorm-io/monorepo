import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";

type RequestData = {
  id: string;
};

export const deleteClientSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const deleteClientController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    entity: { client, publicKey },
    mongo: { clientRepository, publicKeyRepository },
  } = ctx;

  await clientRepository.destroy(client);
  await publicKeyRepository.destroy(publicKey);
};
