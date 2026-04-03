import { ParsedJwtPayload } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { PylonContext, PylonMiddleware } from "../../types";

type TokenOption = { token?: string };

export const useRoles = (...args: Array<string | TokenOption>): PylonMiddleware => {
  const last = args[args.length - 1];
  const hasOptions = typeof last === "object" && last !== null;
  const tokenKey = hasOptions ? (last.token ?? "accessToken") : "accessToken";
  const required = (hasOptions ? args.slice(0, -1) : args) as Array<string>;

  if (!required.length) {
    throw new Error("useRoles requires at least one role");
  }

  return async function useRolesMiddleware(ctx: PylonContext, next) {
    const token = ctx.state.tokens[tokenKey];

    if (!token) {
      throw new ClientError("Token not found", {
        details: `Expected token [${tokenKey}] on context`,
        status: ClientError.Status.Unauthorized,
      });
    }

    const payload = token.payload as ParsedJwtPayload;
    const hasRole = required.some((r) => payload.roles.includes(r));

    if (!hasRole) {
      throw new ClientError("Insufficient roles", {
        details: `Requires at least one of: ${required.join(", ")}`,
        status: ClientError.Status.Forbidden,
      });
    }

    await next();
  };
};
