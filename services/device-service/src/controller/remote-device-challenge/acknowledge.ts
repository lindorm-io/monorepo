import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { configuration } from "../../server/configuration";
import { difference } from "lodash";
import { ClientScopes } from "../../common";
import { ClientError } from "@lindorm-io/errors";
import {
  AcknowledgeRdcRequestParams,
  AcknowledgeRdcResponse,
  DeviceTokenType,
  EmitSocketEventRequestBody,
  RdcSessionMode,
  SessionStatus,
  SubjectHint,
} from "@lindorm-io/common-types";

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
    axios: { communicationClient, oauthClient },
    cache: { rdcSessionCache },
    entity: { rdcSession },
    jwt,
    metadata,
    token: { bearerToken },
  } = ctx;

  if (rdcSession.status !== SessionStatus.PENDING) {
    throw new ClientError("Invalid session status");
  }

  if (rdcSession.identityId !== bearerToken.subject) {
    throw new ClientError("Invalid bearer token");
  }

  if (!metadata.device.linkId) {
    throw new ClientError("Invalid metadata", {
      description: "Expected metadata is missing",
      data: { linkId: metadata.device.linkId },
    });
  }

  rdcSession.status = SessionStatus.ACKNOWLEDGED;

  const {
    id,
    audiences,
    expires,
    factors,
    identityId,
    mode,
    nonce,
    scopes,
    status,
    templateName,
    templateParameters,
    tokenPayload,
  } = rdcSession;

  const { token: rdcSessionToken, expiresIn } = jwt.sign({
    audiences: [configuration.oauth.client_id],
    expiry: expires,
    session: id,
    sessionHint: "rdc",
    subject: identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: DeviceTokenType.REMOTE_DEVICE_CHALLENGE_SESSION,
  });

  await rdcSessionCache.update(rdcSession);

  const deviceLinks = difference<string>(rdcSession.deviceLinks, [metadata.device.linkId]);

  if (mode === RdcSessionMode.PUSH_NOTIFICATION && deviceLinks.length) {
    const body: EmitSocketEventRequestBody = {
      channels: { deviceLinks, identities: [identityId] },
      content: { id },
      event: "rdcSession:acknowledged",
    };

    await communicationClient.post("/admin/socket/emit", {
      body,
      middleware: [
        clientCredentialsMiddleware(oauthClient, [ClientScopes.COMMUNICATION_EVENT_EMIT]),
      ],
    });
  }

  return {
    body: {
      id,
      challenge: {
        audiences,
        identityId,
        nonce,
        payload: tokenPayload,
        scopes,
      },
      session: {
        expiresIn,
        factors,
        rdcSessionToken,
        status,
      },
      template: {
        name: templateName!,
        parameters: templateParameters,
      },
    },
  };
};
