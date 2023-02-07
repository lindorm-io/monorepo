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
  identityAuthMiddleware(),
  //TODO: Add permissions middleware
  useSchema(createTenantSchema),
  useController(createTenantController),
);

router.get(
  "/:id",
  paramsMiddleware,
  identityAuthMiddleware(),
  //TODO: Add permissions middleware
  useSchema(getTenantInfoSchema),
  tenantEntityMiddleware("data.id"),
  assertTenantPermissionMiddleware,
  useController(getTenantInfoController),
);

router.patch(
  "/:id",
  paramsMiddleware,
  identityAuthMiddleware(),
  //TODO: Add permissions middleware
  useSchema(updateTenantSchema),
  tenantEntityMiddleware("data.id"),
  assertTenantPermissionMiddleware,
  useController(updateTenantController),
);

router.delete(
  "/:id",
  paramsMiddleware,
  identityAuthMiddleware(),
  //TODO: Add permissions middleware
  useSchema(deleteTenantSchema),
  tenantEntityMiddleware("data.id"),
  assertTenantPermissionMiddleware,
  useController(deleteTenantController),
);
