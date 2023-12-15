import { AesCipher } from "@lindorm-io/aes";
import {
  GetEncryptedRecordRequestParams,
  GetEncryptedRecordResponse,
} from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { parseBlob } from "@lindorm-io/string-blob";
import { isAfter } from "date-fns";
import Joi from "joi";
import { getEncryptionKey } from "../../handler";
import { ServerKoaController } from "../../types";

type RequestData = GetEncryptedRecordRequestParams;

type ResponseBody = GetEncryptedRecordResponse;

export const getEncryptedRecordSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const getEncryptedRecordController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    entity: { encryptedRecord },
    mongo: { encryptedRecordRepository },
  } = ctx;

  if (encryptedRecord.expires && isAfter(new Date(), encryptedRecord.expires)) {
    await encryptedRecordRepository.destroy(encryptedRecord);

    throw new ClientError("Record has expired", {
      code: "expired_record",
    });
  }

  const encryptionKey = await getEncryptionKey(ctx);
  const aesCipher = new AesCipher({ secret: encryptionKey });

  let blob: string;

  try {
    blob = aesCipher.decrypt(encryptedRecord.encryptedData);
  } catch (err: any) {
    throw new ClientError("Forbidden", {
      code: "invalid_encryption_Key",
      error: err,
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

  return {
    body: {
      data: parseBlob(blob),
      expires: encryptedRecord.expires ? encryptedRecord.expires.toISOString() : null,
    },
  };
};
