import Joi from "joi";
import { Context } from "../../types";
import { Controller, ControllerResponse } from "@lindorm-io/koa";
import { TokenType } from "../../enum";
import { clientCredentialsMiddleware } from "../../middleware";
import { difference } from "lodash";
import { ClientScope, JOI_GUID, RdcSessionMode, SessionStatus, SubjectHint } from "../../common";

interface RequestData {
  id: string;
}

interface ResponseBody {
  id: string;
  challenge: {
    clientId: string;
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

export const acknowledgeRdcSchema = Joi.object<RequestData>({
  id: JOI_GUID.required(),
});

export const acknowledgeRdcController: Controller<Context<RequestData>> = async (
  ctx,
): ControllerResponse<ResponseBody> => {
  const {
    axios: { communicationClient, oauthClient },
    cache: { rdcSessionCache },
    entity: { rdcSession },
    jwt,
    metadata: {
      client,
      device: { linkId },
    },
  } = ctx;

  rdcSession.status = SessionStatus.ACKNOWLEDGED;

  const {
    id,
    clientId,
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
    audiences: [client.id],
    expiry: expires,
    sessionId: id,
    subject: identityId,
    subjectHint: SubjectHint.IDENTITY,
    type: TokenType.REMOTE_DEVICE_CHALLENGE_SESSION_TOKEN,
  });

  await rdcSessionCache.update(rdcSession);

  const deviceLinks = difference(rdcSession.deviceLinks, [linkId]);

  if (mode === RdcSessionMode.PUSH_NOTIFICATION && deviceLinks.length) {
    await communicationClient.post("/internal/socket/emit", {
      data: {
        event: "rdcSession:acknowledged",
        channels: {
          deviceLinks,
          identities: [identityId],
        },
        content: {
          id,
        },
      },
      middleware: [
        clientCredentialsMiddleware(oauthClient, [ClientScope.COMMUNICATION_EVENT_EMIT]),
      ],
    });
  }

  return {
    body: {
      id,
      challenge: {
        clientId,
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
