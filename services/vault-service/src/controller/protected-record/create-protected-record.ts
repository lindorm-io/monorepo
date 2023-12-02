import {
  CreateProtectedRecordRequestBody,
  CreateProtectedRecordResponse,
} from "@lindorm-io/common-types";
import { CryptoAes } from "@lindorm-io/crypto";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse, HttpStatus } from "@lindorm-io/koa";
import { stringifyBlob } from "@lindorm-io/string-blob";
import { randomBytes } from "crypto";
import Joi from "joi";
import { ProtectedRecord } from "../../entity";
import { ServerKoaController } from "../../types";

type RequestData = CreateProtectedRecordRequestBody;

type ResponseBody = CreateProtectedRecordResponse;

export const createProtectedRecordSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    data: Joi.object().required(),
    expires: Joi.string().allow(null).optional(),
  })
  .required();

export const createProtectedRecordController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    data: { id, data, expires },
    mongo: { protectedRecordRepository },
    token: {
      bearerToken: {
        metadata: { subjectHint },
        subject,
      },
    },
  } = ctx;

  const key = randomBytes(16).toString("hex");
  const crypto = new CryptoAes({ secret: key });

  if (!subjectHint) {
    throw new ClientError("Bad Request", {
      description: "Invalid token",
      data: { subjectHint },
    });
  }

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
