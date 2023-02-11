import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { configuration } from "../../server/configuration";
import { difference } from "lodash";
import { ClientScopes } from "../../common";
import {
  AcknowledgeRdcRequestParams,
  AcknowledgeRdcResponse,
  EmitSocketEventRequestBody,
  LindormTokenTypes,
  RdcSessionModes,
  SessionStatuses,
  SubjectHints,
} from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";

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
    metadata: {
      device: { linkId },
    },
  } = ctx;

  if (!linkId) {
    throw new ClientError("Bad Request", {
      description: "Missing metadata",
      data: { linkId },
    });
  }

  rdcSession.status = SessionStatuses.ACKNOWLEDGED;

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
    sessionId: id,
    subject: identityId,
    subjectHint: SubjectHints.IDENTITY,
    type: LindormTokenTypes.REMOTE_DEVICE_CHALLENGE_SESSION,
  });

  await rdcSessionCache.update(rdcSession);

  const deviceLinks = difference<string>(rdcSession.deviceLinks, [linkId]);

  if (mode === RdcSessionModes.PUSH_NOTIFICATION && deviceLinks.length) {
    const body: EmitSocketEventRequestBody = {
      channels: { deviceLinks, identities: [identityId] },
      content: { id },
      event: "rdcSession:acknowledged",
    };

    await communicationClient.post("/internal/socket/emit", {
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
        name: templateName,
        parameters: templateParameters,
      },
    },
  };
};
