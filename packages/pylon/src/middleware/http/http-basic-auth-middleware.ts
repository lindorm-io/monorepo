import { B64 } from "@lindorm/b64";
import { ClientError } from "@lindorm/errors";
import { isArray, isFunction } from "@lindorm/is";
import { AuthorizationType } from "../../enums";
import { PylonError } from "../../errors";
import { Credentials, PylonHttpMiddleware } from "../../types";

type VerifyCredentialsFn = (username: string, password: string) => Promise<void>;

const defaultCallback =
  (credentials: Array<Credentials>): VerifyCredentialsFn =>
  async (username, password) => {
    const credential = credentials.find((item) => item.username === username);

    if (!credential) {
      throw new ClientError("Invalid credentials", {
        status: ClientError.Status.Unauthorized,
        details: "No matching credential found",
        debug: { username },
      });
    }

    if (credential.password !== password) {
      throw new ClientError("Invalid credentials", {
        status: ClientError.Status.Unauthorized,
        details: "Password does not match",
        debug: { username, password },
      });
    }
  };

export const createHttpBasicAuthMiddleware = (
  credentials: Array<Credentials> | VerifyCredentialsFn,
): PylonHttpMiddleware => {
  if (isArray(credentials) && !credentials.length) {
    throw new PylonError("No credentials provided");
  }

  const array = isArray(credentials) ? credentials : [];
  const verify = isFunction(credentials) ? credentials : defaultCallback(array);

  return async function httpBasicAuthMiddleware(ctx, next) {
    if (ctx.state.authorization.type !== AuthorizationType.Basic) {
      throw new ClientError("Invalid Authorization header", {
        details: "Authorization header must be of type Basic",
        debug: {
          header: ctx.get("authorization"),
          state: ctx.state.authorization,
        },
        status: ClientError.Status.Unauthorized,
      });
    }

    const parsed = B64.toString(ctx.state.authorization.value);

    if (!parsed.includes(":")) {
      throw new ClientError("Invalid credentials", {
        status: ClientError.Status.Unauthorized,
        details: "Invalid credentials format",
        debug: { parsed },
      });
    }

    const [username, password] = parsed.split(":");

    try {
      await verify(username, password);
    } catch (error: any) {
      throw new ClientError("Invalid credentials", {
        error,
        debug: { username, password },
        status: ClientError.Status.Unauthorized,
      });
    }

    await next();
  };
};
