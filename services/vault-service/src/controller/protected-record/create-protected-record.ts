import Joi from "joi";
import { ControllerResponse, HttpStatus } from "@lindorm-io/koa";
import { CryptoAES } from "@lindorm-io/crypto";
import { ProtectedRecord } from "../../entity";
import { ServerKoaController } from "../../types";
import { randomString } from "@lindorm-io/random";
import { stringifyBlob } from "@lindorm-io/string-blob";
import {
  CreateProtectedRecordRequestBody,
  CreateProtectedRecordResponse,
} from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";

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
      bearerToken: { subject, subjectHint },
    },
  } = ctx;

  const key = randomString(128, { numbers: "random", symbols: "random" });
  const crypto = new CryptoAES({ secret: key });

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
