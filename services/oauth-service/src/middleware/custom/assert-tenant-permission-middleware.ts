import { ClientError } from "@lindorm-io/errors";
import { ServerKoaMiddleware } from "../../types";

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

  if (!tenant.administrators.includes(identityId)) {
    throw new ClientError("Unauthorized to make changes to tenant");
  }

  await next();
};
