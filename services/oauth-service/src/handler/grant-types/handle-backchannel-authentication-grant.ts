import { OpenIdBackchannelAuthMode, SessionStatus } from "@lindorm-io/common-enums";
import { TokenRequestBody, TokenResponse } from "@lindorm-io/common-types";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { generateTokenResponse } from "../oauth";

export const handleBackchannelAuthenticationGrant = async (
  ctx: ServerKoaContext<TokenRequestBody>,
): Promise<Partial<TokenResponse>> => {
  const {
    data: { authReqId },
    entity: { client },
    mongo: { clientSessionRepository },
    redis: { backchannelSessionCache },
  } = ctx;

  const backchannelSession = await backchannelSessionCache.find({ id: authReqId });

  if (backchannelSession.clientId !== client.id) {
    throw new ClientError("Invalid Request", {
      code: "invalid_request",
      description: "Invalid client ID",
    });
  }

  if (client.backchannelAuthMode === OpenIdBackchannelAuthMode.PUSH) {
    throw new ClientError("Invalid Request", {
      code: "invalid_request",
      description: "Invalid client backchannel auth mode",
      debug: { backchannelAuthMode: client.backchannelAuthMode },
    });
  }

  if (
    backchannelSession.status.consent === SessionStatus.PENDING ||
    backchannelSession.status.login === SessionStatus.PENDING
  ) {
    throw new ClientError("Authorization Pending", {
      code: "authorization_pending",
    });
  }

  if (
    backchannelSession.status.consent === SessionStatus.REJECTED ||
    backchannelSession.status.login === SessionStatus.REJECTED
  ) {
    throw new ClientError("Access Denied", {
      code: "access_denied",
      description: "The end-user denied the authorization request",
    });
  }

  if (
    backchannelSession.status.consent !== SessionStatus.CONFIRMED ||
    backchannelSession.status.login !== SessionStatus.CONFIRMED
  ) {
    throw new ServerError("Unexpected session status");
  }

  if (!backchannelSession.clientSessionId) {
    throw new ServerError("Unexpected session data", {
      description: "Backchannel session has invalid data",
      debug: { clientSessionId: backchannelSession.clientSessionId },
    });
  }

  const clientSession = await clientSessionRepository.find({
    id: backchannelSession.clientSessionId,
  });

  return await generateTokenResponse(ctx, client, clientSession);
};
