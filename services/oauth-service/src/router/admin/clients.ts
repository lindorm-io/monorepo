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

router.use(
  identityAuthMiddleware(),
  //TODO: Add permissions middleware
);

router.patch(
  "/:id",
  paramsMiddleware,
  identityAuthMiddleware(),
  useSchema(adminClientSchema),
  clientEntityMiddleware("data.id"),
  tenantEntityMiddleware("entity.client.tenantId"),
  assertTenantPermissionMiddleware,
  useController(adminClientController),
);
