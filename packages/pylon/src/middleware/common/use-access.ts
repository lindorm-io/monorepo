import { Aegis, isParsedJwt, JwtClaimMatchers } from "@lindorm/aegis";
import { ClientError, LindormError } from "@lindorm/errors";
import { Dict } from "@lindorm/types";
import { PylonContext, PylonMiddleware } from "../../types";

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
        throw new ClientError("Token is not active", {
          status: ClientError.Status.Unauthorized,
        });
      }

      claims = introspection as Dict;
    } else {
      const token = ctx.state.tokens[tokenKey];

      if (!token || !isParsedJwt(token)) {
        throw new ClientError("Token not found", {
          details: `Expected token [${tokenKey}] on context`,
          status: ClientError.Status.Unauthorized,
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
        });
      }
      throw err;
    }

    await next();
  };
};
