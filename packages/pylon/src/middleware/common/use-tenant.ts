import { ClientError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import objectPath from "object-path";
import type { PylonContext, PylonMiddleware } from "../../types/index.js";

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
    let source: "path" | "access" | "introspection";
    let details: string;

    if (path) {
      // An explicit path is the operator naming WHERE the tenant lives; it
      // outranks everything the request resolved on its own.
      source = "path";
      details = `Expected tenant at path [${path}]`;

      const value = objectPath.get(ctx, path);
      tenantId = isString(value) && value.length ? value : undefined;
    } else if (ctx.state.access) {
      // The credential the request actually carried, already resolved by
      // `useAccessToken` — on BOTH the locally-verified and the introspected
      // path, so this reads the same field either way. Introspecting again would
      // be a network round trip PER REQUEST to re-ask a question this request has
      // already answered, and a second source of truth free to disagree with the
      // first. A resolved credential carrying no tenant HAS no tenant; there is
      // nothing to fall back to.
      source = "access";
      details = "No tenant claim on the resolved access credential";

      tenantId = ctx.state.access.claims.tenantId ?? undefined;
    } else {
      // Nothing resolved a credential — no `useAccessToken` ahead of this mount —
      // so the authorization server is the only place left to ask (RFC 7662).
      source = "introspection";
      details = "No tenant found in token introspection";

      const introspection = await ctx.auth.introspect();
      tenantId = introspection.active ? (introspection.tenantId ?? undefined) : undefined;
    }

    if (!tenantId && required) {
      throw new ClientError("Tenant ID is required", {
        details,
        status: ClientError.Status.Forbidden,
        code: "tenant_required",
        type: "urn:lindorm:pylon:error:tenant_required",
        title: "Tenant Required",
        data: { source, path: path ?? null },
      });
    }

    ctx.state.tenant = tenantId ?? null;

    if (tenantId && ctx.db) {
      ctx.db.setFilterParams("__scope", { tenantId });
    }

    await next();
  };
};
