import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { argon } from "../../instance";
import { randomUnreserved } from "@lindorm-io/random";

type RequestData = {
  id: string;
};

type ResponseBody = {
  secret: string;
};

export const generateClientSecretSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().required(),
  })
  .required();

export const generateClientSecretController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { client },
    repository: { clientRepository },
  } = ctx;

  const secret = randomUnreserved(128);

  client.secret = await argon.encrypt(secret);

  await clientRepository.update(client);

  return { body: { secret } };
};
