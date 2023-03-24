import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { CryptoAES } from "@lindorm-io/crypto";
import { ServerKoaController } from "../../types";
import { isAfter } from "date-fns";
import { parseBlob } from "@lindorm-io/string-blob";
import {
  UnlockProtectedRecordRequestBody,
  UnlockProtectedRecordRequestParams,
  UnlockProtectedRecordResponse,
} from "@lindorm-io/common-types";

type RequestData = UnlockProtectedRecordRequestParams & UnlockProtectedRecordRequestBody;

type ResponseBody = UnlockProtectedRecordResponse;

export const unlockProtectedRecordSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    key: Joi.string().required(),
  })
  .required();

export const unlockProtectedRecordController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { key },
    entity: { protectedRecord },
    mongo: { protectedRecordRepository },
    token: {
      bearerToken: { subject, subjectHint },
    },
  } = ctx;

  if (protectedRecord.owner !== subject || protectedRecord.ownerType !== subjectHint) {
    throw new ClientError("Forbidden", {
      code: "invalid_owner",
      description: "Subject is not owner of the vault",
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

  if (protectedRecord.expires && isAfter(new Date(), protectedRecord.expires)) {
    await protectedRecordRepository.destroy(protectedRecord);

    throw new ClientError("Record has expired", {
      code: "expired_record",
    });
  }

  const crypto = new CryptoAES({ secret: key });
  let blob: string;

  try {
    blob = crypto.decrypt(protectedRecord.protectedData);
  } catch (err: any) {
    throw new ClientError("Forbidden", {
      code: "invalid_vault_key",
      error: err,
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

  return {
    body: {
      data: parseBlob(blob),
      expires: protectedRecord.expires ? protectedRecord.expires.toISOString() : null,
    },
  };
};
