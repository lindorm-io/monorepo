import { Aegis, type DomainAssert } from "@lindorm/aegis";
import { ClientError, LindormError } from "@lindorm/errors";
import type { Dict } from "@lindorm/types";
import type { PylonContext, PylonMiddleware } from "../../types/index.js";

export type UseAccessOptions = DomainAssert & {
  token?: string;
};

export const useAccess = (options: UseAccessOptions): PylonMiddleware => {
  const { token: tokenKey = "accessToken", ...matchers } = options;

  return async function useAccessMiddleware(ctx: PylonContext, next) {
    let claims: Dict;

    if (tokenKey === "accessToken") {
      // The RESOLVED access credential, whatever established it. Reading state
      // here (rather than calling ctx.auth.introspect()) is what lets a service
      // that verifies its own tokens locally use useAccess with no `auth`
      // configured at all — the middleware already did the work.
      const access = ctx.state.access;

      if (!access) {
        throw new ClientError("Access token middleware is required", {
          status: ClientError.Status.Unauthorized,
          code: "access_not_resolved",
          type: "urn:lindorm:pylon:error:access_not_resolved",
          title: "Access Not Resolved",
          details:
            "useAccess reads ctx.state.access — install useAccessToken ahead of it, or point useAccess at a named token with the `token` option",
        });
      }

      claims = access.claims as Dict;
    } else {
      // A NAMED token is a different question — it addresses one entry of the
      // session's token set, so it keeps reading `tokens`.
      const token = ctx.state.tokens[tokenKey];

      if (!token || token.format !== "jwt") {
        throw new ClientError("Token not found", {
          details: `Expected a parsed JWT at token [${tokenKey}] on context`,
          status: ClientError.Status.Unauthorized,
          code: "token_not_found",
          type: "urn:lindorm:pylon:error:token_not_found",
          title: "Token Not Found",
          data: { token: tokenKey },
        });
      }

      claims = token.claims as Dict;
    }

    try {
      Aegis.assert(claims, matchers);
    } catch (err) {
      if (err instanceof LindormError) {
        // assert keeps the failing claim VALUES in debug (not data); read
        // them from there for the server-only details, and expose only keys to the client.
        const invalid = (
          err.debug as { invalid?: Array<{ key: string; value: unknown }> }
        )?.invalid;
        const details = invalid
          ?.map((i) => `${i.key} (got: ${JSON.stringify(i.value)})`)
          .join("; ");
        throw new ClientError("Access denied", {
          details: details ?? err.message,
          data: { invalid: invalid?.map((i) => i.key) },
          debug: err.debug,
          status: ClientError.Status.Forbidden,
          code: "access_denied",
          type: "urn:lindorm:pylon:error:access_denied",
          title: "Access Denied",
        });
      }
      throw err;
    }

    await next();
  };
};
