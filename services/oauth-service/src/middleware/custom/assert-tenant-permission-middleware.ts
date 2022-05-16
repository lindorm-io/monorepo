import { ClientError } from "@lindorm-io/errors";
import { ServerKoaMiddleware } from "../../types";
import { includes } from "lodash";

export const assertTenantPermissionMiddleware: ServerKoaMiddleware = async (
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
