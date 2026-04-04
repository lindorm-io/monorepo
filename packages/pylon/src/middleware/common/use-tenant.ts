import { ClientError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import { get } from "object-path";
import { PylonContext, PylonMiddleware } from "../../types";

const DEFAULT_PATH = "state.tokens.accessToken.payload.tenantId";

type UseTenantOptions = {
  required?: boolean;
};

export const useTenant = (
  path: string = DEFAULT_PATH,
  options: UseTenantOptions = {},
): PylonMiddleware => {
  const required = options.required ?? true;

  return async function useTenantMiddleware(ctx: PylonContext, next) {
    const value = get(ctx, path);
    const tenantId = isString(value) && value.length ? value : undefined;

    if (!tenantId && required) {
      throw new ClientError("Tenant ID is required", {
        details: `Expected tenant at path [${path}]`,
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
