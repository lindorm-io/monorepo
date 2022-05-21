import Joi from "joi";
import { ControllerResponse, HttpStatus } from "@lindorm-io/koa";
import { CreateEncryptedRecordRequestBody, JOI_GUID } from "../../common";
import { CryptoAES } from "@lindorm-io/crypto";
import { EncryptedRecord } from "../../entity";
import { ServerKoaController } from "../../types";
import { getEncryptionKey } from "../../handler";
import { stringifyBlob } from "@lindorm-io/string-blob";

export const createEncryptedRecordSchema = Joi.object<CreateEncryptedRecordRequestBody>()
  .keys({
    id: JOI_GUID.required(),
    data: Joi.object().required(),
    expires: Joi.string().allow(null).optional(),
  })
  .required();

export const createEncryptedRecordController: ServerKoaController<
  CreateEncryptedRecordRequestBody
> = async (ctx): ControllerResponse => {
  const {
    data: { id, data, expires },
    repository: { encryptedRecordRepository },
  } = ctx;

  const crypto = new CryptoAES({ secret: getEncryptionKey(ctx) });

  await encryptedRecordRepository.create(
    new EncryptedRecord({
      id,
      encryptedData: crypto.encrypt(stringifyBlob(data)),
      expires: expires ? new Date(expires) : null,
    }),
  );

  return {
    body: {},
    status: HttpStatus.Success.CREATED,
  };
};
