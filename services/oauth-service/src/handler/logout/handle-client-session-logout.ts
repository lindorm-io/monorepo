import { ServerError } from "@lindorm-io/errors";
import { Client, LogoutSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { createLogoutToken } from "../token";

export const handleClientSessionLogout = async (
  ctx: ServerKoaContext,
  logoutSession: LogoutSession,
  client: Client,
): Promise<void> => {
  const {
    axios: { axiosClient },
    mongo: { clientSessionRepository },
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

  if (client.backchannelLogoutUri) {
    await axiosClient.post(client.backchannelLogoutUri, {
      body: { logoutToken: token },
    });
  }

  await clientSessionRepository.destroy(clientSession);
};
