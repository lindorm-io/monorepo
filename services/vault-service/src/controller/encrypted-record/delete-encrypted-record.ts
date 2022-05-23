import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { CryptoAES } from "@lindorm-io/crypto";
import { JOI_GUID } from "../../common";
import { ServerKoaController } from "../../types";
import { getEncryptionKey } from "../../handler";

interface RequestData {
  id: string;
}

export const deleteEncryptedRecordSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const deleteEncryptedRecordController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    entity: { encryptedRecord },
    repository: { encryptedRecordRepository },
  } = ctx;

  const crypto = new CryptoAES({ secret: getEncryptionKey(ctx) });

  try {
    crypto.decrypt(encryptedRecord.encryptedData);
  } catch (err) {
    throw new ClientError("Forbidden", {
      code: "invalid_owner",
      error: err,
      description: "Subject is not owner of the vault",
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

  await encryptedRecordRepository.destroy(encryptedRecord);
};
