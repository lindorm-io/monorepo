import { ServerKoaContext } from "../../types";
import { IdentityPermission } from "../../common";
import { Router, paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
import { updateTenantController, updateTenantSchema } from "../../controller";
import {
  assertTenantPermissionMiddleware,
  identityAuthMiddleware,
  tenantEntityMiddleware,
} from "../../middleware";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.patch(
  "/:id",
  paramsMiddleware,
  identityAuthMiddleware({
    permissions: [IdentityPermission.TENANT_ADMIN],
  }),
  useSchema(updateTenantSchema),
  tenantEntityMiddleware("data.id"),
  assertTenantPermissionMiddleware,
  useController(updateTenantController),
);
