import { ClientError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import { get } from "object-path";
import { PylonContext, PylonMiddleware } from "../../types";

type UseTenantOptions = {
  required?: boolean;
};

export const useTenant = (
  path?: string,
  options: UseTenantOptions = {},
): PylonMiddleware => {
  const required = options.required ?? true;

  return async function useTenantMiddleware(ctx: PylonContext, next) {
    let tenantId: string | undefined;

    if (path) {
      const value = get(ctx, path);
      tenantId = isString(value) && value.length ? value : undefined;
    } else {
      const introspection = await ctx.auth.introspect();
      tenantId = introspection.active ? (introspection.tenantId ?? undefined) : undefined;
    }

    if (!tenantId && required) {
      throw new ClientError("Tenant ID is required", {
        details: path
          ? `Expected tenant at path [${path}]`
          : "No tenant found in token introspection",
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
