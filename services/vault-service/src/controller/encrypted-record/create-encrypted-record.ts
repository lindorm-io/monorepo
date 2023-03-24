import Joi from "joi";
import { ControllerResponse, HttpStatus } from "@lindorm-io/koa";
import { CryptoAES } from "@lindorm-io/crypto";
import { EncryptedRecord } from "../../entity";
import { ServerKoaController } from "../../types";
import { getEncryptionKey } from "../../handler";
import { stringifyBlob } from "@lindorm-io/string-blob";
import { CreateEncryptedRecordRequestBody } from "@lindorm-io/common-types";

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

  const crypto = new CryptoAES({ secret: getEncryptionKey(ctx) });

  await encryptedRecordRepository.create(
    new EncryptedRecord({
      id,
      encryptedData: crypto.encrypt(stringifyBlob(data)),
      expires: expires ? new Date(expires) : null,
    }),
  );

  return { status: HttpStatus.Success.CREATED };
};
