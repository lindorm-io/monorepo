import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { CryptoAES } from "@lindorm-io/crypto";
import { ServerKoaController } from "../../types";
import { isAfter } from "date-fns";
import { parseBlob } from "@lindorm-io/string-blob";
import {
  JOI_GUID,
  UnlockProtectedRecordRequestBody,
  UnlockProtectedRecordResponseBody,
} from "../../common";

interface RequestData extends UnlockProtectedRecordRequestBody {
  id: string;
}

export const unlockProtectedRecordSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
    key: Joi.string().required(),
  })
  .required();

export const unlockProtectedRecordController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<UnlockProtectedRecordResponseBody> => {
  const {
    data: { key },
    entity: { protectedRecord },
    repository: { protectedRecordRepository },
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
  } catch (err) {
    throw new ClientError("Forbidden", {
      code: "invalid_vault_key",
      error: err,
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

  return {
    body: {
      data: parseBlob(blob),
      expires: protectedRecord.expires,
    },
  };
};
