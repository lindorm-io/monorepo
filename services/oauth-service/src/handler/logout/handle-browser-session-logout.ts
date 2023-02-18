import { LogoutSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { createLogoutToken } from "../token";
import { setBrowserSessionCookies } from "../cookies";
import { tryFindBrowserSessions } from "../sessions";

export const handleBrowserSessionLogout = async (
  ctx: ServerKoaContext,
  logoutSession: LogoutSession,
): Promise<void> => {
  const {
    axios: { axiosClient },
    cache: { clientCache },
    repository: { accessSessionRepository, browserSessionRepository },
  } = ctx;

  if (!logoutSession.confirmedLogout.browserSessionId) {
    throw new ServerError("Invalid session state", {
      debug: { confirmedLogout: logoutSession.confirmedLogout },
    });
  }

  const browserSessions = await tryFindBrowserSessions(ctx);

  const browserSession = browserSessions.find(
    (x) => x.id === logoutSession.confirmedLogout.browserSessionId,
  );

  const cookies = browserSessions
    .filter((x) => x.id !== logoutSession.confirmedLogout.browserSessionId)
    .map((x) => x.id);

  if (!browserSession) {
    throw new ServerError("Session not found");
  }

  const accessSessions = await accessSessionRepository.findMany({
    browserSessionId: browserSession.id,
  });

  for (const accessSession of accessSessions) {
    const client = await clientCache.find({ id: accessSession.clientId });

    if (client.backChannelLogoutUri) {
      const { token } = createLogoutToken(ctx, client, accessSession);

      await axiosClient.post(client.backChannelLogoutUri, {
        body: { logoutToken: token },
      });
    }
  }

  setBrowserSessionCookies(ctx, cookies);

  await accessSessionRepository.destroyMany(accessSessions);
  await browserSessionRepository.destroy(browserSession);
};
