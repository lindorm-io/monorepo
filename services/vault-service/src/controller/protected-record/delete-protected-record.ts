import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { CryptoAES } from "@lindorm-io/crypto";
import { ServerKoaController } from "../../types";
import {
  DeleteProtectedRecordRequestBody,
  DeleteProtectedRecordRequestParams,
} from "@lindorm-io/common-types";

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

  const crypto = new CryptoAES({ secret: key });

  try {
    crypto.decrypt(protectedRecord.protectedData);
  } catch (err) {
    throw new ClientError("Forbidden", {
      code: "invalid_vault_key",
      error: err,
      statusCode: ClientError.StatusCode.FORBIDDEN,
    });
  }

  await protectedRecordRepository.destroy(protectedRecord);
};
