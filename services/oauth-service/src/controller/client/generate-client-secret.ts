import { ControllerResponse } from "@lindorm-io/koa";
import { randomUnreserved } from "@lindorm-io/random";
import Joi from "joi";
import { argon } from "../../instance";
import { ServerKoaController } from "../../types";

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
    mongo: { clientRepository },
  } = ctx;

  const secret = randomUnreserved(128);

  client.secret = await argon.sign(secret);

  await clientRepository.update(client);

  return { body: { secret } };
};
