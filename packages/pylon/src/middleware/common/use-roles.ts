import { Aegis, type DomainClaims } from "@lindorm/aegis";
import { ClientError, LindormError } from "@lindorm/errors";
import { isObject } from "@lindorm/is";
import type { PylonContext, PylonMiddleware } from "../../types/index.js";

type TokenOption = { token?: string };

export const useRoles = (...args: Array<string | TokenOption>): PylonMiddleware => {
  const last = args[args.length - 1];
  const hasOptions = isObject(last);
  const tokenKey = hasOptions ? (last.token ?? "accessToken") : "accessToken";
  const required = (hasOptions ? args.slice(0, -1) : args) as Array<string>;

  if (!required.length) {
    throw new Error("useRoles requires at least one role");
  }

  return async function useRolesMiddleware(ctx: PylonContext, next) {
    let claims: DomainClaims;

    if (tokenKey === "accessToken") {
      // The RESOLVED access credential — populated on BOTH the locally-verified
      // and the introspected path, so this gate never depends on there being a
      // parsed JWT (or on `auth` being configured at all). Same contract as
      // useAccess / usePermissions: an introspected credential used to pass
      // those two and fail here with `token_not_found`.
      const access = ctx.state.access;

      if (!access) {
        throw new ClientError("Access token middleware is required", {
          status: ClientError.Status.Unauthorized,
          code: "access_not_resolved",
          type: "urn:lindorm:pylon:error:access_not_resolved",
          title: "Access Not Resolved",
          details:
            "useRoles reads ctx.state.access — install useAccessToken ahead of it, or point useRoles at a named token with the `token` option",
        });
      }

      claims = access.claims;
    } else {
      // A NAMED token addresses one entry of the session's token set.
      const token = ctx.state.tokens[tokenKey];

      if (!token) {
        throw new ClientError("Token not found", {
          details: `Expected token [${tokenKey}] on context`,
          status: ClientError.Status.Unauthorized,
          code: "token_not_found",
          type: "urn:lindorm:pylon:error:token_not_found",
          title: "Token Not Found",
          data: { token: tokenKey },
        });
      }

      claims = token.claims;
    }

    // OR logic — at least one required role must be present (`$overlap`).
    try {
      Aegis.assert(claims, { roles: { $overlap: required } });
    } catch (err) {
      if (err instanceof LindormError) {
        throw new ClientError("Insufficient roles", {
          details: `Requires at least one of: ${required.join(", ")}`,
          status: ClientError.Status.Forbidden,
          code: "insufficient_roles",
          type: "urn:lindorm:pylon:error:insufficient_roles",
          title: "Insufficient Roles",
          data: { required },
          debug: { roles: claims.roles },
        });
      }
      throw err;
    }

    await next();
  };
};
