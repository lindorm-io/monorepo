import { IdentityPermission } from "../common";
import { Router, paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
import {
  createTenantController,
  createTenantSchema,
  deleteTenantController,
  deleteTenantSchema,
  getTenantInfoController,
  getTenantInfoSchema,
  updateTenantController,
  updateTenantSchema,
} from "../controller";
import {
  assertTenantPermissionMiddleware,
  identityAuthMiddleware,
  tenantEntityMiddleware,
} from "../middleware";

const router = new Router();
export default router;

router.post(
  "/",
  identityAuthMiddleware({
    permissions: [IdentityPermission.TENANT_WRITE],
  }),
  useSchema(createTenantSchema),
  useController(createTenantController),
);

router.get(
  "/:id",
  paramsMiddleware,
  identityAuthMiddleware({
    permissions: [IdentityPermission.TENANT_READ],
  }),
  useSchema(getTenantInfoSchema),
  tenantEntityMiddleware("data.id"),
  assertTenantPermissionMiddleware,
  useController(getTenantInfoController),
);

router.patch(
  "/:id",
  paramsMiddleware,
  identityAuthMiddleware({
    permissions: [IdentityPermission.TENANT_WRITE],
  }),
  useSchema(updateTenantSchema),
  tenantEntityMiddleware("data.id"),
  assertTenantPermissionMiddleware,
  useController(updateTenantController),
);

router.delete(
  "/:id",
  paramsMiddleware,
  identityAuthMiddleware({
    permissions: [IdentityPermission.TENANT_WRITE],
  }),
  useSchema(deleteTenantSchema),
  tenantEntityMiddleware("data.id"),
  assertTenantPermissionMiddleware,
  useController(deleteTenantController),
);
