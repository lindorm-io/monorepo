import {
  OpenIdBackchannelAuthMode,
  OpenIdGrantType,
  Scope,
  SessionStatus,
} from "@lindorm-io/common-enums";
import { ServerError } from "@lindorm-io/errors";
import { expiryDate } from "@lindorm-io/expiry";
import { randomUnreserved } from "@lindorm-io/random";
import { addSeconds } from "date-fns";
import { BackchannelSession, Client, ClientSession } from "../../entity";
import { ClientSessionType } from "../../enum";
import { ServerKoaContext } from "../../types";
import { handleBackchannelPing } from "./handle-backchannel-ping";
import { handleBackchannelPush } from "./handle-backchannel-push";

export const resolveBackchannelAuthentication = async (
  ctx: ServerKoaContext,
  client: Client,
  backchannelSession: BackchannelSession,
): Promise<void> => {
  const {
    logger,
    mongo: { clientSessionRepository },
    redis: { backchannelSessionCache },
  } = ctx;

  if (backchannelSession.status.consent !== SessionStatus.CONFIRMED) {
    logger.debug("Backchannel session consent is not confirmed", {
      status: backchannelSession.status.consent,
    });

    return;
  }

  if (backchannelSession.status.login !== SessionStatus.CONFIRMED) {
    logger.debug("Backchannel session login is not confirmed", {
      status: backchannelSession.status.login,
    });

    return;
  }

  if (
    !backchannelSession.confirmedConsent.audiences.length ||
    !backchannelSession.confirmedConsent.scopes.length
  ) {
    throw new ServerError("Unexpected session data", {
      description: "Backchannel session has invalid data",
      debug: { confirmedConsent: backchannelSession.confirmedConsent },
    });
  }

  if (
    !backchannelSession.confirmedLogin.identityId ||
    !backchannelSession.confirmedLogin.latestAuthentication ||
    !backchannelSession.confirmedLogin.levelOfAssurance
  ) {
    throw new ServerError("Unexpected session data", {
      description: "Backchannel session has invalid data",
      debug: { confirmedLogin: backchannelSession.confirmedLogin },
    });
  }

  const expires =
    backchannelSession.requestedExpiry > 0
      ? addSeconds(new Date(), backchannelSession.requestedExpiry)
      : expiryDate("1 day");

  const clientSession = await clientSessionRepository.create(
    new ClientSession({
      audiences: backchannelSession.confirmedConsent.audiences,
      authorizationGrant: OpenIdGrantType.BACKCHANNEL_AUTHENTICATION,
      clientId: client.id,
      expires,
      factors: backchannelSession.confirmedLogin.factors,
      identityId: backchannelSession.confirmedLogin.identityId,
      latestAuthentication: backchannelSession.confirmedLogin.latestAuthentication,
      levelOfAssurance: backchannelSession.confirmedLogin.levelOfAssurance,
      methods: backchannelSession.confirmedLogin.methods,
      nonce: randomUnreserved(16),
      scopes: backchannelSession.confirmedConsent.scopes,
      strategies: backchannelSession.confirmedLogin.strategies,
      tenantId: client.tenantId,
      type: backchannelSession.confirmedConsent.scopes.includes(Scope.OFFLINE_ACCESS)
        ? ClientSessionType.REFRESH
        : ClientSessionType.EPHEMERAL,
    }),
  );

  backchannelSession.clientSessionId = clientSession.id;

  await backchannelSessionCache.update(backchannelSession);

  switch (client.backchannelAuth.mode) {
    case OpenIdBackchannelAuthMode.PING:
      await handleBackchannelPing(ctx, client, backchannelSession);
      break;

    case OpenIdBackchannelAuthMode.POLL:
      logger.debug("backchannel auth mode is poll", {
        backchannelAuthMode: client.backchannelAuth.mode,
      });
      break;

    case OpenIdBackchannelAuthMode.PUSH:
      await handleBackchannelPush(ctx, client, backchannelSession, clientSession);
      break;

    default:
      throw new ServerError("Unexpected backchannel auth mode", {
        debug: { backchannelAuthMode: client.backchannelAuth.mode },
      });
  }
};
