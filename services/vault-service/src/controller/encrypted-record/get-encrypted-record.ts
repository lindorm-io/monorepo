import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { CryptoAES } from "@lindorm-io/crypto";
import { ServerKoaController } from "../../types";
import { getEncryptionKey } from "../../handler";
import { isAfter } from "date-fns";
import { parseBlob } from "@lindorm-io/string-blob";
import {
  GetEncryptedRecordRequestParams,
  GetEncryptedRecordResponse,
} from "@lindorm-io/common-types";

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
    repository: { encryptedRecordRepository },
  } = ctx;

  if (encryptedRecord.expires && isAfter(new Date(), encryptedRecord.expires)) {
    await encryptedRecordRepository.destroy(encryptedRecord);

    throw new ClientError("Record has expired", {
      code: "expired_record",
    });
  }

  const crypto = new CryptoAES({ secret: getEncryptionKey(ctx) });
  let blob: string;

  try {
    blob = crypto.decrypt(encryptedRecord.encryptedData);
  } catch (err) {
    throw new ClientError("Forbidden", {
      code: "invalid_encryption_Key",
      error: err,
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

  return { body: { data: parseBlob(blob), expires: encryptedRecord.expires } };
};
