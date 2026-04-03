import { ParsedJwtPayload } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { PylonContext, PylonMiddleware } from "../../types";

type TokenOption = { token?: string };

export const usePermissions = (...args: Array<string | TokenOption>): PylonMiddleware => {
  const last = args[args.length - 1];
  const hasOptions = typeof last === "object" && last !== null;
  const tokenKey = hasOptions ? (last.token ?? "accessToken") : "accessToken";
  const required = (hasOptions ? args.slice(0, -1) : args) as Array<string>;

  if (!required.length) {
    throw new Error("usePermissions requires at least one permission");
  }

  return async function usePermissionsMiddleware(ctx: PylonContext, next) {
    const token = ctx.state.tokens[tokenKey];

    if (!token) {
      throw new ClientError("Token not found", {
        details: `Expected token [${tokenKey}] on context`,
        status: ClientError.Status.Unauthorized,
      });
    }

    const payload = token.payload as ParsedJwtPayload;
    const missing = required.filter((p) => !payload.permissions.includes(p));

    if (missing.length) {
      throw new ClientError("Insufficient permissions", {
        details: `Missing required permissions: ${missing.join(", ")}`,
        status: ClientError.Status.Forbidden,
      });
    }

    await next();
  };
};
