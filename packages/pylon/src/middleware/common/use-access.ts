import { Aegis, isParsedJwt, type JwtClaimMatchers } from "@lindorm/aegis";
import { ClientError, LindormError } from "@lindorm/errors";
import type { Dict } from "@lindorm/types";
import type { PylonContext, PylonMiddleware } from "../../types/index.js";

export type UseAccessOptions = JwtClaimMatchers & {
  token?: string;
};

export const useAccess = (options: UseAccessOptions): PylonMiddleware => {
  const { token: tokenKey = "accessToken", ...matchers } = options;

  return async function useAccessMiddleware(ctx: PylonContext, next) {
    let claims: Dict;

    if (tokenKey === "accessToken") {
      const introspection = await ctx.auth.introspect();

      if (!introspection.active) {
        throw new ClientError("Access token is not active", {
          status: ClientError.Status.Unauthorized,
          code: "token_not_active",
          type: "urn:lindorm:pylon:error:token_not_active",
          details: "Token introspection returned active: false",
        });
      }

      claims = introspection as Dict;
    } else {
      const token = ctx.state.tokens[tokenKey];

      if (!token || !isParsedJwt(token)) {
        throw new ClientError("Token not found", {
          details: `Expected a parsed JWT at token [${tokenKey}] on context`,
          status: ClientError.Status.Unauthorized,
          code: "token_not_found",
          type: "urn:lindorm:pylon:error:token_not_found",
          data: { token: tokenKey },
        });
      }

      claims = token.payload as Dict;
    }

    try {
      Aegis.validateClaims(claims, matchers);
    } catch (err) {
      if (err instanceof LindormError) {
        const invalid = (err.data as { invalid?: Array<{ key: string; value: unknown }> })
          ?.invalid;
        const details = invalid
          ?.map((i) => `${i.key} (got: ${JSON.stringify(i.value)})`)
          .join("; ");
        throw new ClientError("Access denied", {
          details: details ?? err.message,
          data: err.data,
          status: ClientError.Status.Forbidden,
          code: "access_denied",
          type: "urn:lindorm:pylon:error:access_denied",
        });
      }
      throw err;
    }

    await next();
  };
};
