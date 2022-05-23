import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID } from "../../common";
import { ServerKoaController } from "../../types";

interface RequestData {
  id: string;
}

export const deleteProtectedRecordSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
  })
  .required();

export const deleteProtectedRecordController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
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

  await protectedRecordRepository.destroy(protectedRecord);
};
