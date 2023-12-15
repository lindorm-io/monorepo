import { AesCipher } from "@lindorm-io/aes";
import { DeleteEncryptedRecordRequestParams } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { getEncryptionKey } from "../../handler";
import { ServerKoaController } from "../../types";

type RequestData = DeleteEncryptedRecordRequestParams;

export const deleteEncryptedRecordSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const deleteEncryptedRecordController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    entity: { encryptedRecord },
    mongo: { encryptedRecordRepository },
  } = ctx;

  const encryptionKey = await getEncryptionKey(ctx);
  const aesCipher = new AesCipher({ secret: encryptionKey });

  try {
    aesCipher.decrypt(encryptedRecord.encryptedData);
  } catch (err: any) {
    throw new ClientError("Forbidden", {
      code: "invalid_owner",
      error: err,
      description: "Subject is not owner of the vault",
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

  await encryptedRecordRepository.destroy(encryptedRecord);
};
