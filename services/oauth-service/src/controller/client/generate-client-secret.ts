import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { randomString } from "@lindorm-io/random";
import { argon } from "../../instance";

interface RequestData {
  id: string;
}

interface ResponseBody {
  secret: string;
}

export const generateClientSecretSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().required(),
  })
  .required();

export const generateClientSecretController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { clientCache },
    entity: { client },
    repository: { clientRepository },
  } = ctx;

  const secret = randomString(128);

  client.secret = await argon.encrypt(secret);

  const updated = await clientRepository.update(client);
  await clientCache.update(updated);

  return { body: { secret } };
};
