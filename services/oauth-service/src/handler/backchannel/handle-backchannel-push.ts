import { Middleware, axiosBasicAuthMiddleware, axiosBearerAuthMiddleware } from "@lindorm-io/axios";
import { OpenIdBackchannelAuthMode } from "@lindorm-io/common-enums";
import { TokenResponse } from "@lindorm-io/common-types";
import { ServerError } from "@lindorm-io/errors";
import { BackchannelSession, Client, ClientSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { generateTokenResponse } from "../oauth";
import { generateServerBearerAuthMiddleware } from "../token";

type RequestBody = TokenResponse;

export const handleBackchannelPush = async (
  ctx: ServerKoaContext,
  client: Client,
  backchannelSession: BackchannelSession,
  clientSession: ClientSession,
): Promise<void> => {
  const {
    axios: { axiosClient },
    logger,
  } = ctx;

  logger.debug("backchannel auth mode is push", {
    backchannelAuthMode: client.backchannelAuth.mode,
  });

  const { mode, uri, username, password } = client.backchannelAuth;

  if (mode !== OpenIdBackchannelAuthMode.PUSH) {
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

  const body = await generateTokenResponse(ctx, client, clientSession);

  await axiosClient.post<never, RequestBody, never, never>(uri, {
    body,
    middleware,
  });
};
