import { ClientError } from "@lindorm-io/errors";
import { EmitSocketEventRequestData, RdcSessionMode } from "../../common";
import { ServerKoaContext } from "../../types";
import { RdcSession, RdcSessionAttributes } from "../../entity";
import { clientCredentialsMiddleware } from "../../middleware";
import { getExpires } from "@lindorm-io/core";

interface Result {
  id: string;
  expiresIn: number;
}

export const createRdcSession = async (
  ctx: ServerKoaContext,
  options: Partial<RdcSessionAttributes>,
): Promise<Result> => {
  const {
    axios: { communicationClient, oauthClient },
    cache: { rdcSessionCache },
    repository: { deviceLinkRepository },
  } = ctx;

  const {
    audiences,
    confirmMethod,
    confirmPayload,
    confirmUri,
    enrolmentSessionId,
    expires,
    factors,
    identityId,
    mode,
    nonce,
    rejectMethod,
    rejectPayload,
    rejectUri,
    scopes,
    templateName,
    templateParameters,
    tokenPayload,
    type,
  } = options;

  let deviceLinks: Array<string> = [];

  if (mode === RdcSessionMode.PUSH_NOTIFICATION) {
    if (!identityId) {
      throw new ClientError("Invalid Request", {
        description: "identityId nerdcSession to be provided when using push_notification mode",
        debug: {
          expect: "string",
          actual: typeof identityId,
        },
      });
    }

    const deviceLinkList = await deviceLinkRepository.findMany({
      identityId,
      active: true,
      trusted: true,
    });

    deviceLinks = deviceLinkList.map((deviceLink) => deviceLink.id);
  }

  const rdcSession = await rdcSessionCache.create(
    new RdcSession({
      audiences,
      confirmMethod,
      confirmPayload,
      confirmUri,
      deviceLinks,
      enrolmentSessionId,
      expires,
      factors,
      identityId,
      mode,
      nonce,
      rejectMethod,
      rejectPayload,
      rejectUri,
      scopes,
      templateName,
      templateParameters,
      tokenPayload,
      type,
    }),
  );

  const { id } = rdcSession;

  if (mode === RdcSessionMode.PUSH_NOTIFICATION) {
    const body: EmitSocketEventRequestData = {
      channels: { deviceLinks, identities: [identityId] },
      content: { id },
      event: "rdcSession:created",
    };

    await communicationClient.post("/internal/socket/emit", {
      body,
      middleware: [clientCredentialsMiddleware(oauthClient)],
    });
  }

  const { expiresIn } = getExpires(expires);

  return { id, expiresIn };
};
