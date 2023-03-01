import { ClientError } from "@lindorm-io/errors";
import { ClientScopes } from "../../common";
import { EmitSocketEventRequestBody, RdcSessionMode } from "@lindorm-io/common-types";
import { RdcSession, RdcSessionOptions } from "../../entity";
import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";
import { expiryObject } from "@lindorm-io/expiry";

type Result = {
  id: string;
  expiresIn: number;
};

type Options = Omit<RdcSessionOptions, "deviceLinks">;

export const createRdcSession = async (
  ctx: ServerKoaContext,
  options: Options,
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
    const body: EmitSocketEventRequestBody = {
      channels: {
        deviceLinks,
        ...(identityId ? { identities: [identityId] } : {}),
      },
      content: { id },
      event: "rdcSession:created",
    };

    await communicationClient.post("/admin/socket/emit", {
      body,
      middleware: [
        clientCredentialsMiddleware(oauthClient, [ClientScopes.COMMUNICATION_EVENT_EMIT]),
      ],
    });
  }

  const { expiresIn } = expiryObject(expires);

  return { id, expiresIn };
};
