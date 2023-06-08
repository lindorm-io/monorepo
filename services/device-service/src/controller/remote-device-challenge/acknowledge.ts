import {
  AcknowledgeRdcRequestParams,
  AcknowledgeRdcResponse,
  DeviceTokenType,
  EmitSocketEventRequestBody,
  RdcSessionMode,
  SessionStatus,
  SubjectHint,
} from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { ControllerResponse } from "@lindorm-io/koa";
import Joi from "joi";
import { difference } from "lodash";
import { clientCredentialsMiddleware } from "../../middleware";
import { configuration } from "../../server/configuration";
import { ServerKoaController } from "../../types";

type RequestData = AcknowledgeRdcRequestParams;

type ResponseBody = AcknowledgeRdcResponse;

export const acknowledgeRdcSchema = Joi.object<RequestData>()
  .keys({
    id: Joi.string().guid().required(),
  })
  .required();

export const acknowledgeRdcController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    axios: { communicationClient },
    redis: { rdcSessionCache },
    jwt,
    metadata,
    token: { bearerToken },
  } = ctx;

  let {
    entity: { rdcSession },
  } = ctx;

  if (rdcSession.status !== SessionStatus.PENDING) {
    throw new ClientError("Invalid session status");
  }

  if (rdcSession.identityId && rdcSession.identityId !== bearerToken.subject) {
    throw new ClientError("Invalid bearer token");
  }

  if (!metadata.device.linkId) {
    throw new ClientError("Invalid metadata", {
      description: "Expected metadata is missing",
      data: { linkId: metadata.device.linkId },
    });
  }

  rdcSession.identityId = bearerToken.subject;
  rdcSession.status = SessionStatus.ACKNOWLEDGED;

  rdcSession = await rdcSessionCache.update(rdcSession);

  const { token: rdcSessionToken } = jwt.sign({
    audiences: [configuration.oauth.client_id],
    expiry: rdcSession.expires,
    session: rdcSession.id,
    sessionHint: "rdc",
    subject: bearerToken.subject,
    subjectHint: SubjectHint.IDENTITY,
    type: DeviceTokenType.REMOTE_DEVICE_CHALLENGE_SESSION,
  });

  const deviceLinks = difference<string>(rdcSession.deviceLinks, [metadata.device.linkId]);

  if (rdcSession.mode === RdcSessionMode.PUSH_NOTIFICATION && deviceLinks.length) {
    await communicationClient.post<never, EmitSocketEventRequestBody>("/admin/socket/emit", {
      body: {
        channels: { deviceLinks, identities: [bearerToken.subject] },
        content: { id: rdcSession.id },
        event: "rdc_session:acknowledged",
      },
      middleware: [clientCredentialsMiddleware()],
    });
  }

  return {
    body: {
      id: rdcSession.id,
      challenge: {
        audiences: rdcSession.audiences,
        identityId: bearerToken.subject,
        nonce: rdcSession.nonce,
        payload: rdcSession.tokenPayload,
        scopes: rdcSession.scopes,
      },
      session: {
        expires: rdcSession.expires.toISOString(),
        factors: rdcSession.factors,
        rdcSessionToken,
        status: rdcSession.status,
      },
      template: {
        name: rdcSession.templateName,
        parameters: rdcSession.templateParameters,
      },
    },
  };
};
