import { ClientError } from "@lindorm-io/errors";
import { Context } from "../../types";
import { Middleware } from "@lindorm-io/koa";
import { argon } from "../../instance";
import { getCredentials } from "@lindorm-io/koa-basic-auth";
import { Client } from "../../entity";

export const assertClientMiddleware: Middleware<Context> = async (ctx, next): Promise<void> => {
  const {
    cache: { clientCache },
    data,
  } = ctx;

  let clientId = data.clientId;
  let clientSecret = data.clientSecret;
  let client: Client;

  if (clientId) {
    client = await clientCache.find({ id: clientId });
  } else {
    const { type, value } = ctx.getAuthorizationHeader();

    if (type !== "Basic") {
      throw new ClientError("Invalid Authorization Header");
    }

    ({ username: clientId, password: clientSecret } = getCredentials(value));

    client = await clientCache.find({ id: clientId });
  }

  if (clientSecret) {
    try {
      await argon.assert(clientSecret, client.secret);
    } catch (err) {
      throw new ClientError("Invalid Client Secret", {
        code: "invalid_request",
        description: "Invalid client secret",
        error: err,
      });
    }
  }

  if (!client.active) {
    throw new ClientError("Client is not active");
  }

  ctx.entity.client = client;

  await next();
};
