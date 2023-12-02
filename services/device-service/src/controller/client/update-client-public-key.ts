import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { PublicKey } from "../../entity";
import { ServerKoaController } from "../../types";

type RequestData = {
  id: string;
  publicKey: string;
};

type ResponseBody = {
  publicKeyId: string;
};

export const updateClientPublicKeySchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    publicKey: Joi.string().required(),
  })
  .required();

export const updateClientPublicKeyController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { publicKey: updatedPublicKey },
    entity: { client, publicKey },
    mongo: { clientRepository, publicKeyRepository },
  } = ctx;

  const created = await publicKeyRepository.create(
    new PublicKey({
      key: updatedPublicKey,
    }),
  );

  await publicKeyRepository.destroy(publicKey);

  client.publicKeyId = created.id;

  await clientRepository.update(client);

  return { body: { publicKeyId: created.id } };
};
