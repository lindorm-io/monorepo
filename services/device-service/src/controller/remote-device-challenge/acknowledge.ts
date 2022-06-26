import Joi from "joi";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { configuration } from "../../server/configuration";
import { difference } from "lodash";
import {
  EmitSocketEventRequestData,
  JOI_GUID,
  RdcSessionMode,
  SessionStatus,
  SubjectHint,
  TokenType,
} from "../../common";

interface RequestData {
  id: string;
}

interface ResponseBody {
  id: string;
  challenge: {
    audiences: Array<string>;
    identityId: string;
    nonce: string;
    payload: Record<string, any>;
    scopes: Array<string>;
  };
  session: {
    expiresIn: number;
    factors: number;
    rdcSessionToken: string;
    status: SessionStatus;
  };
  template: {
    name: string;
    parameters: Record<string, unknown>;
  };
}

export const acknowledgeRdcSchema = Joi.object<RequestData>()
  .keys({
    id: JOI_GUID.required(),
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
    sessionId: id,
    subject: identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.REMOTE_DEVICE_CHALLENGE_SESSION,
  });

  await rdcSessionCache.update(rdcSession);

  const deviceLinks = difference(rdcSession.deviceLinks, [linkId]);

  if (mode === RdcSessionMode.PUSH_NOTIFICATION && deviceLinks.length) {
    const body: EmitSocketEventRequestData = {
      channels: { deviceLinks, identities: [identityId] },
      content: { id },
      event: "rdcSession:acknowledged",
    };

    await communicationClient.post("/internal/socket/emit", {
      body,
      middleware: [clientCredentialsMiddleware(oauthClient)],
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
