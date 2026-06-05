import { B64 } from "@lindorm/b64";
import { ClientError } from "@lindorm/errors";
import { isArray, isFunction } from "@lindorm/is";
import { PylonError } from "../../errors/index.js";
import type { Credentials, PylonMiddleware } from "../../types/index.js";

type VerifyCredentialsFn = (username: string, password: string) => Promise<void>;

const defaultCallback =
  (credentials: Array<Credentials>): VerifyCredentialsFn =>
  async (username, password) => {
    const credential = credentials.find((item) => item.username === username);

    if (!credential) {
      throw new ClientError("Invalid credentials", {
        status: ClientError.Status.Unauthorized,
        code: "invalid_credentials",
        type: "urn:lindorm:pylon:error:invalid_credentials",
        details: "No matching credential found",
        debug: { username, reason: "unknown_username" },
      });
    }

    if (credential.password !== password) {
      throw new ClientError("Invalid credentials", {
        status: ClientError.Status.Unauthorized,
        code: "invalid_credentials",
        type: "urn:lindorm:pylon:error:invalid_credentials",
        details: "Password does not match",
        debug: { username, password, reason: "password_mismatch" },
      });
    }
  };

export const createBasicAuthMiddleware = (
  credentials: Array<Credentials> | VerifyCredentialsFn,
): PylonMiddleware => {
  if (isArray(credentials) && !credentials.length) {
    throw new PylonError("No credentials provided", {
      code: "no_credentials_configured",
      details:
        "createBasicAuthMiddleware was given an empty credentials array; provide at least one credential or a verify callback",
    });
  }

  const array = isArray(credentials) ? credentials : [];
  const verify = isFunction(credentials) ? credentials : defaultCallback(array);

  return async function basicAuthMiddleware(ctx, next) {
    if (ctx.state.authorization.type !== "basic") {
      throw new ClientError("Invalid Authorization header", {
        details: "Authorization header must be of type basic",
        debug: { state: ctx.state.authorization },
        status: ClientError.Status.Unauthorized,
        code: "invalid_authorization_header",
        type: "urn:lindorm:pylon:error:invalid_authorization_header",
        data: { expected: "basic", received: ctx.state.authorization.type },
      });
    }

    const parsed = B64.toString(ctx.state.authorization.value);

    if (!parsed.includes(":")) {
      throw new ClientError("Invalid credentials", {
        status: ClientError.Status.Unauthorized,
        code: "invalid_credentials",
        type: "urn:lindorm:pylon:error:invalid_credentials",
        details: "Decoded basic credentials are not in username:password format",
        debug: { parsed, reason: "malformed_credentials" },
      });
    }

    const [username, password] = parsed.split(":");

    try {
      await verify(username, password);
    } catch (error: any) {
      throw new ClientError("Invalid credentials", {
        error,
        status: ClientError.Status.Unauthorized,
        code: "invalid_credentials",
        type: "urn:lindorm:pylon:error:invalid_credentials",
        details: "Credential verification callback rejected the credentials",
        debug: { username, password, reason: "verify_callback_rejected" },
      });
    }

    await next();
  };
};
