import { Router, paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
import { updateTenantController, updateTenantSchema } from "../../controller";
import {
  assertTenantPermissionMiddleware,
  identityAuthMiddleware,
  tenantEntityMiddleware,
} from "../../middleware";

const router = new Router();
export default router;

router.use(
  identityAuthMiddleware(),
  //TODO: Add permissions middleware
);

router.patch(
  "/:id",
  paramsMiddleware,
  useSchema(updateTenantSchema),
  tenantEntityMiddleware("data.id"),
  assertTenantPermissionMiddleware,
  useController(updateTenantController),
);
