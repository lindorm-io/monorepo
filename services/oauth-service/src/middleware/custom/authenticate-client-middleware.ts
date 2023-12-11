import { OpenIdClientType } from "@lindorm-io/common-enums";
import { ClientError } from "@lindorm-io/errors";
import { Algorithm } from "@lindorm-io/key-pair";
import { getCredentials } from "@lindorm-io/koa-basic-auth";
import { Client } from "../../entity";
import { verifyAssertionId } from "../../handler";
import { argon } from "../../instance";
import { configuration } from "../../server/configuration";
import { ServerKoaMiddleware } from "../../types";

export const authenticateClientMiddleware: ServerKoaMiddleware = async (
  ctx,
  next,
): Promise<void> => {
  const {
    data,
    jwt,
    mongo: { clientRepository },
  } = ctx;

  let id = data.clientId;
  let secret = data.clientSecret;
  let client: Client;
  let authenticated = false;

  const assertion: string = data.clientAssertion;
  const assertionType: string = data.clientAssertionType;

  if (id) {
    client = await clientRepository.find({ id });
  } else {
    const { type, value } = ctx.getAuthorizationHeader();

    if (type !== "Basic") {
      throw new ClientError("Invalid Authorization Header");
    }

    ({ username: id, password: secret } = getCredentials(value));

    client = await clientRepository.find({ id });
  }

  if (!client) {
    throw new ClientError("Client not found");
  }

  if (!client.active) {
    throw new ClientError("Client has been disabled");
  }

  if (secret) {
    try {
      await argon.assert(secret, client.secret);

      authenticated = true;
    } catch (err: any) {
      throw new ClientError("Invalid Client Secret", {
        code: "invalid_request",
        description: "Invalid client secret",
        error: err,
      });
    }
  }

  if (assertion && assertionType === "urn:ietf:params:oauth:client-assertion-type:jwt-bearer") {
    try {
      const verified = jwt.verify(assertion, {
        algorithms: client.authenticationAssertion.algorithm
          ? [client.authenticationAssertion.algorithm]
          : [Algorithm.HS256],
        audience: configuration.oauth.client_id,
        clockTolerance: 10,
        issuer: client.authenticationAssertion.issuer ?? client.id,
        maxAge: 60,
        secret: client.authenticationAssertion.secret ?? client.secret,
        subject: client.id,
      });

      await verifyAssertionId(ctx, verified.id);

      authenticated = true;
    } catch (err: any) {
      throw new ClientError("Invalid Client Assertion", {
        code: "invalid_request",
        description: "Invalid client assertion",
        error: err,
      });
    }
  }

  if (client.type === OpenIdClientType.CONFIDENTIAL && !authenticated) {
    throw new ClientError("Unauthorized", {
      description: "Confidential clients require secrets",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  ctx.entity.client = client;

  await next();
};
