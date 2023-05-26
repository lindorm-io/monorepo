import { OpenIdClientType } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { getCredentials } from "@lindorm-io/koa-basic-auth";
import { Client } from "../../entity";
import { argon } from "../../instance";
import { ServerKoaMiddleware } from "../../types";

export const assertClientMiddleware: ServerKoaMiddleware = async (ctx, next): Promise<void> => {
  const {
    data,
    mongo: { clientRepository },
  } = ctx;

  let clientId = data.clientId;
  let clientSecret = data.clientSecret;
  let client: Client;

  if (clientId) {
    client = await clientRepository.find({ id: clientId });
  } else {
    const { type, value } = ctx.getAuthorizationHeader();

    if (type !== "Basic") {
      throw new ClientError("Invalid Authorization Header");
    }

    ({ username: clientId, password: clientSecret } = getCredentials(value));

    client = await clientRepository.find({ id: clientId });
  }

  if (!client.active) {
    throw new ClientError("Client is not active");
  }

  if (client.type === OpenIdClientType.CONFIDENTIAL && !clientSecret) {
    throw new ClientError("Unauthorized", {
      description: "Confidential clients require secrets",
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
