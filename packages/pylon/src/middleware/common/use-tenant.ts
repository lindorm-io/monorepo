import { ParsedJwtPayload } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { isHttpContext } from "#internal/utils/is-context";
import { PylonContext, PylonMiddleware } from "../../types";

type UseTenantOptions = {
  required?: boolean;
  token?: string;
  header?: string;
};

export const useTenant = (options: UseTenantOptions = {}): PylonMiddleware => {
  const tokenKey = options.token ?? "accessToken";
  const required = options.required ?? true;

  return async function useTenantMiddleware(ctx: PylonContext, next) {
    let tenantId: string | undefined;

    const token = ctx.state.tokens[tokenKey];

    if (token) {
      const payload = token.payload as ParsedJwtPayload;
      tenantId = payload.tenantId ?? undefined;
    }

    if (!tenantId && options.header && isHttpContext(ctx)) {
      const headerValue = ctx.get(options.header);

      if (headerValue && typeof headerValue === "string") {
        tenantId = headerValue;
      }
    }

    if (!tenantId && required) {
      throw new ClientError("Tenant ID is required", {
        status: ClientError.Status.Forbidden,
        code: "tenant_required",
      });
    }

    ctx.state.tenant = tenantId ?? null;

    if (tenantId && ctx.proteus) {
      ctx.proteus.setFilterParams("__scope", { tenantId });
    }

    await next();
  };
};
