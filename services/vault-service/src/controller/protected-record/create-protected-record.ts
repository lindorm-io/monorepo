import Joi from "joi";
import { ControllerResponse, HttpStatus } from "@lindorm-io/koa";
import {
  CreateProtectedRecordRequestBody,
  CreateProtectedRecordResponseBody,
  JOI_GUID,
} from "../../common";
import { CryptoAES } from "@lindorm-io/crypto";
import { ServerKoaController } from "../../types";
import { ProtectedRecord } from "../../entity";
import { randomString } from "@lindorm-io/core";
import { stringifyBlob } from "@lindorm-io/string-blob";

export const createProtectedRecordSchema = Joi.object<CreateProtectedRecordRequestBody>()
  .keys({
    id: JOI_GUID.required(),
    data: Joi.object().required(),
    expires: Joi.string().allow(null).optional(),
  })
  .required();

export const createProtectedRecordController: ServerKoaController<
  CreateProtectedRecordRequestBody
> = async (ctx): ControllerResponse<CreateProtectedRecordResponseBody> => {
  const {
    data: { id, data, expires },
    repository: { protectedRecordRepository },
    token: {
      bearerToken: { subject, subjectHint },
    },
  } = ctx;

  const key = randomString(128);
  const crypto = new CryptoAES({ secret: key });

  await protectedRecordRepository.create(
    new ProtectedRecord({
      id,
      protectedData: crypto.encrypt(stringifyBlob(data)),
      expires: expires ? new Date(expires) : null,
      owner: subject,
      ownerType: subjectHint,
    }),
  );

  return { body: { key }, status: HttpStatus.Success.CREATED };
};
