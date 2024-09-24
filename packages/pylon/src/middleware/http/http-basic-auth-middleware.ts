import { B64 } from "@lindorm/b64";
import { ClientError } from "@lindorm/errors";
import { PylonError } from "../../errors";
import { Credentials, PylonHttpMiddleware } from "../../types";

export const createHttpBasicAuthMiddleware = (
  credentials: Array<Credentials>,
): PylonHttpMiddleware => {
  if (credentials.length === 0) {
    throw new PylonError("No credentials provided");
  }

  return async function httpBasicAuthMiddleware(ctx, next) {
    const authorization = ctx.get("Authorization");

    if (!authorization) {
      throw new ClientError("Authorization header is required", {
        status: ClientError.Status.Unauthorized,
      });
    }

    const [authType, encoded] = authorization.split(" ");

    if (authType !== "Basic") {
      throw new ClientError("Authorization header must be of type Basic", {
        status: ClientError.Status.Unauthorized,
      });
    }

    const parsed = B64.toString(encoded);

    if (!parsed.includes(":")) {
      throw new ClientError("Authorization header must contain a colon", {
        status: ClientError.Status.Unauthorized,
      });
    }

    const [username, password] = parsed.split(":");

    const credential = credentials.find((item) => item.username === username);

    if (!credential) {
      throw new ClientError("Invalid credentials", {
        status: ClientError.Status.Unauthorized,
        debug: { username },
      });
    }

    if (credential.password !== password) {
      throw new ClientError("Invalid credentials", {
        status: ClientError.Status.Unauthorized,
        debug: { username, password },
      });
    }

    ctx.logger.debug("Basic Auth successful", {
      credential,
    });

    await next();
  };
};
