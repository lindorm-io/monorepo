import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_GUID, JOI_JWT, RdcSessionType, SessionStatus } from "../../common";
import { assertConfirmationTokenFactorLength } from "../../util";
import { clientCredentialsMiddleware } from "../../middleware";
import { updateEnrolmentStatus } from "../../handler";

interface RequestData {
  id: string;
  challengeConfirmationToken: string;
  rdcSessionToken: string;
}

export const confirmRdcSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
    challengeConfirmationToken: JOI_JWT.required(),
    rdcSessionToken: JOI_JWT.required(),
  })
  .required();

export const confirmRdcController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { axiosClient, oauthClient },
    cache: { rdcSessionCache },
    entity: { rdcSession },
    token: { challengeConfirmationToken },
  } = ctx;

  assertConfirmationTokenFactorLength(challengeConfirmationToken, rdcSession.factors);

  rdcSession.status = SessionStatus.CONFIRMED;

  switch (rdcSession.type) {
    case RdcSessionType.CALLBACK:
      await axiosClient.request(rdcSession.confirmMethod, rdcSession.confirmUri, {
        data: {
          rdcSessionId: rdcSession.id,
          rdcSessionStatus: rdcSession.status,
          challengeConfirmationToken: challengeConfirmationToken.token,
          ...rdcSession.confirmPayload,
        },
        middleware: [clientCredentialsMiddleware(oauthClient)],
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
