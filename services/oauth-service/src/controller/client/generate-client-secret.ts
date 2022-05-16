import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { getRandomString } from "@lindorm-io/core";
import { argon } from "../../instance";

interface RequestData {
  id: string;
}

interface ResponseBody {
  secret: string;
}

export const generateClientSecretSchema = Joi.object<RequestData>({
  id: Joi.string().required(),
});

export const generateClientSecretController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    cache: { clientCache },
    entity: { client },
    repository: { clientRepository },
  } = ctx;

  const secret = getRandomString(128);

  client.secret = await argon.encrypt(secret);

  const updated = await clientRepository.update(client);
  await clientCache.update(updated);

  return {
    body: {
      secret,
    },
  };
};
