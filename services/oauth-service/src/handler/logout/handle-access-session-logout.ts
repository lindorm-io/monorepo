import { Client, LogoutSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { createLogoutToken } from "../token";

export const handleAccessSessionLogout = async (
  ctx: ServerKoaContext,
  logoutSession: LogoutSession,
  client: Client,
): Promise<void> => {
  const {
    axios: { axiosClient },
    repository: { accessSessionRepository },
  } = ctx;

  if (!logoutSession.confirmedLogout.accessSessionId) {
    throw new ServerError("Invalid session state", {
      debug: { confirmedLogout: logoutSession.confirmedLogout },
    });
  }

  const accessSession = await accessSessionRepository.find({
    id: logoutSession.confirmedLogout.accessSessionId,
  });

  if (client.backChannelLogoutUri) {
    const { token } = createLogoutToken(ctx, client, accessSession);

    await axiosClient.post(client.backChannelLogoutUri, {
      body: { logoutToken: token },
    });
  }

  await accessSessionRepository.destroy(accessSession);
};
