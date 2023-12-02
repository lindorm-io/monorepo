import { CreateEncryptedRecordRequestBody } from "@lindorm-io/common-types";
import { CryptoAes } from "@lindorm-io/crypto";
import { ControllerResponse, HttpStatus } from "@lindorm-io/koa";
import { stringifyBlob } from "@lindorm-io/string-blob";
import Joi from "joi";
import { EncryptedRecord } from "../../entity";
import { getEncryptionKey } from "../../handler";
import { ServerKoaController } from "../../types";

type RequestData = CreateEncryptedRecordRequestBody;

export const createEncryptedRecordSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    data: Joi.object().required(),
    expires: Joi.string().allow(null).optional(),
  })
  .required();

export const createEncryptedRecordController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { id, data, expires },
    mongo: { encryptedRecordRepository },
  } = ctx;

  const encryptionKey = await getEncryptionKey(ctx);
  const crypto = new CryptoAes({ secret: encryptionKey });

  await encryptedRecordRepository.create(
    new EncryptedRecord({
      id,
      encryptedData: crypto.encrypt(stringifyBlob(data)),
      expires: expires ? new Date(expires) : null,
    }),
  );

  return { status: HttpStatus.Success.CREATED };
};
