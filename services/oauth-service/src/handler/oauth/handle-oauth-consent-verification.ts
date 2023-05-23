import { SessionStatus } from "@lindorm-io/common-types";
import { AuthorizationRequest, Client } from "../../entity";
import { ServerKoaContext } from "../../types";
import { getUpdatedClientSession } from "../sessions";

export const handleOauthConsentVerification = async (
  ctx: ServerKoaContext,
  authorizationRequest: AuthorizationRequest,
  client: Client,
): Promise<AuthorizationRequest> => {
  const {
    redis: { authorizationRequestCache },
  } = ctx;

  const clientSession = await getUpdatedClientSession(ctx, authorizationRequest, client);

  authorizationRequest.clientSessionId = clientSession.id;
  authorizationRequest.status.consent = SessionStatus.VERIFIED;

  return await authorizationRequestCache.update(authorizationRequest);
};
