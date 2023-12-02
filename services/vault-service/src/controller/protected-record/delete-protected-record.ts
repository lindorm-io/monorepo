import {
  DeleteProtectedRecordRequestBody,
  DeleteProtectedRecordRequestParams,
} from "@lindorm-io/common-types";
import { CryptoAes } from "@lindorm-io/crypto";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { ServerKoaController } from "../../types";

type RequestData = DeleteProtectedRecordRequestParams & DeleteProtectedRecordRequestBody;

export const deleteProtectedRecordSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    key: Joi.string().required(),
  })
  .required();

export const deleteProtectedRecordController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    data: { key },
    entity: { protectedRecord },
    mongo: { protectedRecordRepository },
    token: {
      bearerToken: {
        metadata: { subjectHint },
        subject,
      },
    },
  } = ctx;

  if (protectedRecord.owner !== subject || protectedRecord.ownerType !== subjectHint) {
    throw new ClientError("Forbidden", {
      code: "invalid_owner",
      description: "Subject is not owner of the vault",
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

  const crypto = new CryptoAes({ secret: key });

  try {
    crypto.decrypt(protectedRecord.protectedData);
  } catch (err: any) {
    throw new ClientError("Forbidden", {
      code: "invalid_vault_key",
      error: err,
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

  await protectedRecordRepository.destroy(protectedRecord);
};
