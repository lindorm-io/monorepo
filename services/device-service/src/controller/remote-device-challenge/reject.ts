import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse, HttpStatus } from "@lindorm-io/koa";
import { JOI_GUID, JOI_JWT, RdcSessionType, SessionStatus } from "../../common";
import { clientCredentialsMiddleware } from "../../middleware";
import { updateEnrolmentStatus } from "../../handler";

interface RequestData {
  id: string;
  rdcSessionToken: string;
}

export const rejectRdcSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
  rdcSessionToken: JOI_JWT.required(),
});

export const rejectRdcController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { axiosClient, oauthClient },
    cache: { rdcSessionCache },
    entity: { rdcSession },
  } = ctx;

  rdcSession.status = SessionStatus.REJECTED;

  switch (rdcSession.type) {
    case RdcSessionType.CALLBACK:
      await axiosClient.request(rdcSession.rejectMethod, rdcSession.rejectUri, {
        data: {
          rdcSessionId: rdcSession.id,
          rdcSessionStatus: rdcSession.status,
          ...rdcSession.rejectPayload,
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

  return {
    body: {},
    status: HttpStatus.Success.ACCEPTED,
  };
};
