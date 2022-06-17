import { ServerKoaContext } from "../../types";
import { LogoutSession } from "../../entity";
import { createLogoutToken } from "../token";
import { handleConsentSessionOnLogout } from "./handle-consent-session-on-logout";

export const handleRefreshSessionLogout = async (
  ctx: ServerKoaContext,
  logoutSession: LogoutSession,
): Promise<void> => {
  const {
    axios: { axiosClient },
    cache: { clientCache },
    repository: { refreshSessionRepository },
  } = ctx;

  const refreshSession = await refreshSessionRepository.find({
    id: logoutSession.sessionId,
  });

  const client = await clientCache.find({ id: refreshSession.clientId });

  const { token: logoutToken } = await createLogoutToken(ctx, client, refreshSession);

  await axiosClient.post(client.logoutUri, {
    body: { logoutToken },
  });

  await handleConsentSessionOnLogout(ctx, client, refreshSession);

  await refreshSessionRepository.destroy(refreshSession);
};
