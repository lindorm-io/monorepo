import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { Client, PublicKey } from "../../entity";
import { ServerKoaController } from "../../types";

type RequestData = {
  id: string;
  name: string | null | undefined;
  publicKey: string;
};

type ResponseBody = {
  publicKeyId: string;
};

export const createClientSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    name: Joi.string().allow(null),
    publicKey: Joi.string().required(),
  })
  .required();

export const createClientController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { id, name, publicKey },
    mongo: { clientRepository, publicKeyRepository },
  } = ctx;

  const createdPublicKey = await publicKeyRepository.create(
    new PublicKey({
      key: publicKey,
    }),
  );

  await clientRepository.create(
    new Client({
      id,
      active: true,
      name,
      publicKeyId: createdPublicKey.id,
    }),
  );

  return {
    body: { publicKeyId: createdPublicKey.id },
  };
};
