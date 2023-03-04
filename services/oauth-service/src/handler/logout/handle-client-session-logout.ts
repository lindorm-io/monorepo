import { Client, LogoutSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { createLogoutToken } from "../token";

export const handleClientSessionLogout = async (
  ctx: ServerKoaContext,
  logoutSession: LogoutSession,
  client: Client,
): Promise<void> => {
  const {
    axios: { axiosClient },
    repository: { clientSessionRepository },
  } = ctx;

  if (!logoutSession.confirmedLogout.clientSessionId) {
    throw new ServerError("Invalid session state", {
      debug: { confirmedLogout: logoutSession.confirmedLogout },
    });
  }

  const clientSession = await clientSessionRepository.find({
    id: logoutSession.confirmedLogout.clientSessionId,
  });

  const { token } = createLogoutToken(ctx, client, clientSession);

  if (client.backChannelLogoutUri) {
    await axiosClient.post(client.backChannelLogoutUri, {
      body: { logoutToken: token },
    });
  }

  await clientSessionRepository.destroy(clientSession);
};
