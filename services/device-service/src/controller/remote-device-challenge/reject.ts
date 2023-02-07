import Joi from "joi";
import { ServerKoaController } from "../../types";
import { ControllerResponse } from "@lindorm-io/koa";
import { JOI_JWT } from "../../common";
import { clientCredentialsMiddleware } from "../../middleware";
import { updateEnrolmentStatus } from "../../handler";
import {
  RdcSessionTypes,
  RejectRdcRequestBody,
  RejectRdcRequestParams,
  SessionStatuses,
} from "@lindorm-io/common-types";

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
    axios: { axiosClient, oauthClient },
    cache: { rdcSessionCache },
    entity: { rdcSession },
  } = ctx;

  rdcSession.status = SessionStatuses.REJECTED;

  switch (rdcSession.type) {
    case RdcSessionTypes.CALLBACK:
      await axiosClient.request({
        body: {
          rdcSessionId: rdcSession.id,
          rdcSessionStatus: rdcSession.status,
          ...rdcSession.rejectPayload,
        },
        method: rdcSession.rejectMethod,
        middleware: [clientCredentialsMiddleware(oauthClient, ["unknown"])],
        url: rdcSession.rejectUri,
      });
      break;

    case RdcSessionTypes.ENROLMENT:
      await updateEnrolmentStatus(ctx, rdcSession);
      break;

    default:
      break;
  }

  await rdcSessionCache.update(rdcSession);
};
