import { ServerError } from "@lindorm-io/errors";
import { BackchannelSession, Client, ClientSession } from "../../entity";
import { ServerKoaContext } from "../../types";

export const handleBackchannelPing = async (
  ctx: ServerKoaContext,
  client: Client,
  backchannelSession: BackchannelSession,
  clientSession: ClientSession,
): Promise<void> => {
  const {
    // axios: { axiosClient },
    logger,
  } = ctx;

  logger.debug("backchannel auth mode is ping", {
    backchannelAuthMode: client.backchannelAuthMode,
  });

  if (!client.backchannelAuthCallbackUri) {
    throw new ServerError("Unexpected client data", {
      description: "Client has invalid data",
      debug: { backchannelAuthCallbackUri: client.backchannelAuthCallbackUri },
    });
  }

  throw new Error("Not implemented");

  // await axiosClient.post(client.backchannelAuthCallbackUri, {});
};
