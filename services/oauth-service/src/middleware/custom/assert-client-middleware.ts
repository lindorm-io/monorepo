import { Client } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { ServerKoaMiddleware } from "../../types";
import { argon } from "../../instance";
import { getCredentials } from "@lindorm-io/koa-basic-auth";

export const assertClientMiddleware: ServerKoaMiddleware = async (ctx, next): Promise<void> => {
  const {
    cache: { clientCache },
    data,
  } = ctx;

  let clientId = data.clientId;
  let clientSecret = data.clientSecret;
  let client: Client;

  if (clientId) {
    client = await clientCache.find({ id: clientId });

    if (client.enforceBasicAuth) {
      throw new ClientError("Unauthorized", {
        data: { enforceBasicAuth: client.enforceBasicAuth },
        description: "Client is configured to require basic auth",
        statusCode: ClientError.StatusCode.UNAUTHORIZED,
      });
    }
  } else {
    const { type, value } = ctx.getAuthorizationHeader();

    if (type !== "Basic") {
      throw new ClientError("Invalid Authorization Header");
    }

    ({ username: clientId, password: clientSecret } = getCredentials(value));

    client = await clientCache.find({ id: clientId });
  }

  if (!client.active) {
    throw new ClientError("Client is not active");
  }

  if (client.enforceSecret && !clientSecret) {
    throw new ClientError("Unauthorized", {
      data: { enforceSecret: client.enforceSecret },
      description: "Client is configured to require secret",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  if (clientSecret) {
    try {
      await argon.assert(clientSecret, client.secret);
    } catch (err: any) {
      throw new ClientError("Invalid Client Secret", {
        code: "invalid_request",
        description: "Invalid client secret",
        error: err,
      });
    }
  }

  ctx.entity.client = client;

  await next();
};
