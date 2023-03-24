import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_JWT } from "../../common";
import { clientCredentialsMiddleware } from "../../middleware";
import { updateEnrolmentStatus } from "../../handler";
import {
  RdcSessionType,
  RejectRdcRequestBody,
  RejectRdcRequestParams,
  SessionStatus,
} from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";

type RequestData = RejectRdcRequestParams & RejectRdcRequestBody;

export const rejectRdcSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    rdcSessionToken: JOI_JWT.required(),
  })
  .required();

export const rejectRdcController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { axiosClient },
    redis: { rdcSessionCache },
    entity: { rdcSession },
    token: { bearerToken, rdcSessionToken },
  } = ctx;

  if (![SessionStatus.ACKNOWLEDGED, SessionStatus.PENDING].includes(rdcSession.status)) {
    throw new ClientError("Invalid session status");
  }

  if (rdcSession.identityId !== bearerToken.subject) {
    throw new ClientError("Invalid bearer token", {
      description: "Bearer token subject does not match RDC session subject",
      debug: {
        expect: rdcSession.identityId,
        actual: bearerToken.subject,
      },
    });
  }

  if (rdcSession.id !== rdcSessionToken.session) {
    throw new ClientError("Invalid session token");
  }

  rdcSession.status = SessionStatus.REJECTED;

  switch (rdcSession.type) {
    case RdcSessionType.CALLBACK:
      await axiosClient.request({
        body: {
          rdcSessionId: rdcSession.id,
          rdcSessionStatus: rdcSession.status,
          ...rdcSession.rejectPayload,
        },
        method: rdcSession.rejectMethod,
        middleware: [clientCredentialsMiddleware()],
        url: rdcSession.rejectUri || undefined,
      });
      break;

    case RdcSessionType.ENROLMENT:
      await updateEnrolmentStatus(ctx, rdcSession);
      break;

    default:
      break;
  }

  await rdcSessionCache.update(rdcSession);
};
