import { RsaKeySet } from "@lindorm-io/jwk";
import { ControllerResponse } from "@lindorm-io/koa";
import { randomUUID } from "crypto";
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

  const keySet = RsaKeySet.fromPem({ id: randomUUID(), publicKey: updatedPublicKey, type: "RSA" });

  const created = await publicKeyRepository.create(PublicKey.fromKeySet(keySet));

  await publicKeyRepository.destroy(publicKey);

  client.publicKeyId = created.id;

  await clientRepository.update(client);

  return { body: { publicKeyId: created.id } };
};
