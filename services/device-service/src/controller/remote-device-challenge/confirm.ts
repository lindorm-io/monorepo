import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_JWT } from "../../common";
import { ServerKoaController } from "../../types";
import { assertConfirmationTokenFactorLength } from "../../util";
import { clientCredentialsMiddleware } from "../../middleware";
import { updateEnrolmentStatus } from "../../handler";
import {
  ConfirmRdcRequestBody,
  ConfirmRdcRequestParams,
  RdcSessionType,
  SessionStatus,
} from "@lindorm-io/common-types";

type RequestData = ConfirmRdcRequestParams & ConfirmRdcRequestBody;

export const confirmRdcSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
    challengeConfirmationToken: JOI_JWT.required(),
    rdcSessionToken: JOI_JWT.required(),
  })
  .required();

export const confirmRdcController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { axiosClient },
    cache: { rdcSessionCache },
    entity: { rdcSession },
    token: { bearerToken, challengeConfirmationToken, rdcSessionToken },
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

  if (rdcSession.identityId !== challengeConfirmationToken.subject) {
    throw new ClientError("Invalid confirmation token", {
      description: "Confirmation token subject does not match RDC session subject",
      debug: {
        expect: rdcSession.identityId,
        actual: challengeConfirmationToken.subject,
      },
    });
  }

  if (rdcSession.id !== rdcSessionToken.session) {
    throw new ClientError("Invalid session token");
  }

  if (rdcSession.nonce !== challengeConfirmationToken.nonce) {
    throw new ClientError("Invalid confirmation token");
  }

  assertConfirmationTokenFactorLength(challengeConfirmationToken, rdcSession.factors);

  rdcSession.status = SessionStatus.CONFIRMED;

  switch (rdcSession.type) {
    case RdcSessionType.CALLBACK:
      await axiosClient.request({
        body: {
          rdcSessionId: rdcSession.id,
          rdcSessionStatus: rdcSession.status,
          challengeConfirmationToken: challengeConfirmationToken.token,
          ...rdcSession.confirmPayload,
        },
        method: rdcSession.confirmMethod,
        middleware: [clientCredentialsMiddleware()],
        url: rdcSession.confirmUri || undefined,
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
