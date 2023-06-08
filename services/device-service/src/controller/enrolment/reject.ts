import { RejectEnrolmentRequestBody, RejectEnrolmentRequestParams } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { JOI_JWT } from "../../common";
import { ServerKoaController } from "../../types";

type RequestData = RejectEnrolmentRequestParams & RejectEnrolmentRequestBody;

export const rejectEnrolmentSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    enrolmentSessionToken: JOI_JWT.required(),
  })
  .required();

export const rejectEnrolmentController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    redis: { enrolmentSessionCache },
    entity: { enrolmentSession },
    token: { bearerToken, enrolmentSessionToken },
  } = ctx;

  if (enrolmentSession.identityId !== bearerToken.subject) {
    throw new ClientError("Invalid token subject");
  }

  if (enrolmentSession.id !== enrolmentSessionToken.metadata.session) {
    throw new ClientError("Invalid token session");
  }

  await enrolmentSessionCache.destroy(enrolmentSession);
};
