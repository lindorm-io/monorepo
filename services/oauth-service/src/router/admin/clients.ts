import { IdentityPermission } from "../../common";
import { Router, paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
import { adminClientController, adminClientSchema } from "../../controller";
import {
  assertTenantPermissionMiddleware,
  clientEntityMiddleware,
  identityAuthMiddleware,
  tenantEntityMiddleware,
} from "../../middleware";

const router = new Router();
export default router;

router.patch(
  "/:id",
  paramsMiddleware,
  identityAuthMiddleware({
    permissions: [IdentityPermission.CLIENT_ADMIN],
  }),
  useSchema(adminClientSchema),
  clientEntityMiddleware("data.id"),
  tenantEntityMiddleware("entity.client.tenantId"),
  assertTenantPermissionMiddleware,
  useController(adminClientController),
);
