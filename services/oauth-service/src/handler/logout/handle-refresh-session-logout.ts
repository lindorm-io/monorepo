import { Client, LogoutSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { createLogoutToken } from "../token";

export const handleRefreshSessionLogout = async (
  ctx: ServerKoaContext,
  logoutSession: LogoutSession,
  client: Client,
): Promise<void> => {
  const {
    axios: { axiosClient },
    repository: { refreshSessionRepository },
  } = ctx;

  if (!logoutSession.confirmedLogout.refreshSessionId) {
    throw new ServerError("Invalid session state", {
      debug: { confirmedLogout: logoutSession.confirmedLogout },
    });
  }

  const refreshSession = await refreshSessionRepository.find({
    id: logoutSession.confirmedLogout.refreshSessionId,
  });

  const { token } = createLogoutToken(ctx, client, refreshSession);

  if (client.backChannelLogoutUri) {
    await axiosClient.post(client.backChannelLogoutUri, {
      body: { logoutToken: token },
    });
  }

  await refreshSessionRepository.destroy(refreshSession);
};
