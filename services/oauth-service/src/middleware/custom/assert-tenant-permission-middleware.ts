import { ClientError } from "@lindorm-io/errors";
import { Context } from "../../types";
import { Middleware } from "@lindorm-io/koa";
import { includes } from "lodash";

export const assertTenantPermissionMiddleware: Middleware<Context> = async (
  ctx,
  next,
): Promise<void> => {
  const {
    entity: { tenant },
    token: {
      bearerToken: { subject: identityId },
    },
  } = ctx;

  if (!tenant.active) {
    throw new ClientError("Tenant is not active");
  }

  if (!includes(tenant.administrators, identityId)) {
    throw new ClientError("Unauthorized to make changes to tenant");
  }

  await next();
};
