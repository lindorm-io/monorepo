import { ClientError } from "@lindorm-io/errors";
import { EmitSocketEventRequestBody, RdcSessionMode } from "@lindorm-io/common-types";
import { RdcSession, RdcSessionOptions } from "../../entity";
import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";

type Options = Omit<RdcSessionOptions, "deviceLinks">;

export const createRdcSession = async (
  ctx: ServerKoaContext,
  options: Options,
): Promise<RdcSession> => {
  const {
    axios: { communicationClient },
    redis: { rdcSessionCache },
    mongo: { deviceLinkRepository },
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

  if (mode === RdcSessionMode.PUSH_NOTIFICATION) {
    await communicationClient.post<never, EmitSocketEventRequestBody>("/admin/socket/emit", {
      body: {
        channels: {
          deviceLinks,
          ...(identityId ? { identities: [identityId] } : {}),
        },
        content: { id: rdcSession.id },
        event: "rdc_session:created",
      },
      middleware: [clientCredentialsMiddleware()],
    });
  }

  return rdcSession;
};
