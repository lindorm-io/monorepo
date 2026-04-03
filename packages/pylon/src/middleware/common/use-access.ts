import { ParsedJwtPayload } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { PylonContext, PylonMiddleware } from "../../types";

type UseAccessOptions = {
  roles?: Array<string>;
  permissions?: Array<string>;
  scopes?: Array<string>;
  levelOfAssurance?: number;
  adjustedAccessLevel?: number;
  token?: string;
};

export const useAccess = (options: UseAccessOptions): PylonMiddleware => {
  const tokenKey = options.token ?? "accessToken";

  return async function useAccessMiddleware(ctx: PylonContext, next) {
    const token = ctx.state.tokens[tokenKey];

    if (!token) {
      throw new ClientError("Token not found", {
        details: `Expected token [${tokenKey}] on context`,
        status: ClientError.Status.Unauthorized,
      });
    }

    const payload = token.payload as ParsedJwtPayload;
    const errors: Array<string> = [];

    if (options.roles?.length) {
      const hasRole = options.roles.some((r) => payload.roles.includes(r));
      if (!hasRole) {
        errors.push(`Requires at least one role: ${options.roles.join(", ")}`);
      }
    }

    if (options.permissions?.length) {
      const missing = options.permissions.filter((p) => !payload.permissions.includes(p));
      if (missing.length) {
        errors.push(`Missing required permissions: ${missing.join(", ")}`);
      }
    }

    if (options.scopes?.length) {
      const hasScope = options.scopes.some((s) => payload.scope.includes(s));
      if (!hasScope) {
        errors.push(`Requires at least one scope: ${options.scopes.join(", ")}`);
      }
    }

    if (options.levelOfAssurance != null) {
      if (
        payload.levelOfAssurance == null ||
        payload.levelOfAssurance < options.levelOfAssurance
      ) {
        errors.push(
          `Requires level of assurance >= ${options.levelOfAssurance}, got ${payload.levelOfAssurance ?? "none"}`,
        );
      }
    }

    if (options.adjustedAccessLevel != null) {
      if (
        payload.adjustedAccessLevel == null ||
        payload.adjustedAccessLevel < options.adjustedAccessLevel
      ) {
        errors.push(
          `Requires adjusted access level >= ${options.adjustedAccessLevel}, got ${payload.adjustedAccessLevel ?? "none"}`,
        );
      }
    }

    if (errors.length) {
      throw new ClientError("Access denied", {
        details: errors.join("; "),
        status: ClientError.Status.Forbidden,
      });
    }

    await next();
  };
};
