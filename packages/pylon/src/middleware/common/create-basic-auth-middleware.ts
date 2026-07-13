import { ClientError } from "@lindorm/errors";
import { isArray, isFunction } from "@lindorm/is";
import { PylonError } from "../../errors/index.js";
import { parseBasicCredentials } from "../../internal/utils/auth/parse-basic-credentials.js";
import { verifyBasicPassword } from "../../internal/utils/auth/verify-basic-password.js";
import type { Credentials, PylonMiddleware } from "../../types/index.js";

type VerifyCredentialsFn = (username: string, password: string) => Promise<void>;

const defaultCallback =
  (credentials: Array<Credentials>): VerifyCredentialsFn =>
  async (username, password) => {
    const credential = credentials.find((item) => item.username === username);

    // The password comparison runs even when the username is unknown - returning early here
    // would make the unknown-username path measurably cheaper and enumerate valid usernames.
    if (verifyBasicPassword(password, credential?.password)) return;

    throw new ClientError("Invalid credentials", {
      status: ClientError.Status.Unauthorized,
      code: "invalid_credentials",
      type: "urn:lindorm:pylon:error:invalid_credentials",
      title: "Invalid Credentials",
      details: credential ? "Password does not match" : "No matching credential found",
      debug: {
        username,
        reason: credential ? "password_mismatch" : "unknown_username",
      },
    });
  };

export const createBasicAuthMiddleware = (
  credentials: Array<Credentials> | VerifyCredentialsFn,
): PylonMiddleware => {
  if (isArray(credentials) && !credentials.length) {
    throw new PylonError("No credentials provided", {
      code: "no_credentials_configured",
      title: "No Credentials Configured",
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
        title: "Invalid Authorization Header",
        data: { expected: "basic", received: ctx.state.authorization.type },
      });
    }

    const credentials = parseBasicCredentials(ctx.state.authorization.value);

    if (!credentials) {
      throw new ClientError("Invalid credentials", {
        status: ClientError.Status.Unauthorized,
        code: "invalid_credentials",
        type: "urn:lindorm:pylon:error:invalid_credentials",
        title: "Invalid Credentials",
        details: "Decoded basic credentials are not in username:password format",
        debug: { reason: "malformed_credentials" },
      });
    }

    const { username, password } = credentials;

    try {
      await verify(username, password);
    } catch (error: any) {
      throw new ClientError("Invalid credentials", {
        error,
        status: ClientError.Status.Unauthorized,
        code: "invalid_credentials",
        type: "urn:lindorm:pylon:error:invalid_credentials",
        title: "Invalid Credentials",
        details: "Credential verification callback rejected the credentials",
        debug: { username, reason: "verify_callback_rejected" },
      });
    }

    await next();
  };
};
