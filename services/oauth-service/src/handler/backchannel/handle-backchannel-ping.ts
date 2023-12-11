import { Middleware, axiosBasicAuthMiddleware, axiosBearerAuthMiddleware } from "@lindorm-io/axios";
import { OpenIdBackchannelAuthMode } from "@lindorm-io/common-enums";
import { ServerError } from "@lindorm-io/errors";
import { BackchannelSession, Client } from "../../entity";
import { ServerKoaContext } from "../../types";
import { generateServerBearerAuthMiddleware } from "../token";

type RequestBody = { authReqId: string };

export const handleBackchannelPing = async (
  ctx: ServerKoaContext,
  client: Client,
  backchannelSession: BackchannelSession,
): Promise<void> => {
  const {
    axios: { axiosClient },
    logger,
  } = ctx;

  logger.debug("backchannel auth mode is ping", {
    backchannelAuthMode: client.backchannelAuth.mode,
  });

  const { mode, uri, username, password } = client.backchannelAuth;

  if (mode !== OpenIdBackchannelAuthMode.PING) {
    throw new ServerError("Unexpected client data", {
      description: "Client has invalid data",
      debug: { mode },
    });
  }

  if (!uri) {
    throw new ServerError("Unexpected client data", {
      description: "Client has invalid data",
      debug: { uri },
    });
  }

  let middleware: Array<Middleware> = [];

  if (backchannelSession.clientNotificationToken) {
    middleware.push(axiosBearerAuthMiddleware(backchannelSession.clientNotificationToken));
  } else if (username && password) {
    middleware.push(axiosBasicAuthMiddleware({ username, password }));
  } else {
    middleware.push(generateServerBearerAuthMiddleware(ctx, [client.id]));
  }

  await axiosClient.post<never, RequestBody, never, never>(uri, {
    body: { authReqId: backchannelSession.id },
    middleware,
  });
};
