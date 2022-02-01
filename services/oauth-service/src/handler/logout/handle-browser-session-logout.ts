import { Context } from "../../types";
import { LogoutSession } from "../../entity";
import { createLogoutToken } from "../token";
import { handleConsentSessionOnLogout } from "./handle-consent-session-on-logout";

export const handleBrowserSessionLogout = async (
  ctx: Context,
  logoutSession: LogoutSession,
): Promise<void> => {
  const {
    axios: { axiosClient },
    cache: { clientCache },
    repository: { browserSessionRepository },
  } = ctx;

  const browserSession = await browserSessionRepository.find({
    id: logoutSession.sessionId,
  });

  for (const clientId of browserSession.clients) {
    const client = await clientCache.find({ id: clientId });

    const { token: logoutToken } = await createLogoutToken(ctx, client, browserSession);

    await axiosClient.post(client.logoutUri, {
      data: { logoutToken },
    });

    await handleConsentSessionOnLogout(ctx, client, browserSession);
  }

  await browserSessionRepository.destroy(browserSession);
};
