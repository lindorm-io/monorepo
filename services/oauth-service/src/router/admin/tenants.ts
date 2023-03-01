import { Router, paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
import { clientAuthMiddleware, tenantEntityMiddleware } from "../../middleware";
import {
  createTenantController,
  createTenantSchema,
  deleteTenantController,
  deleteTenantSchema,
  getTenantInfoController,
  getTenantInfoSchema,
  updateTenantController,
  updateTenantSchema,
} from "../../controller";

const router = new Router<any, any>();
export default router;

router.use(
  clientAuthMiddleware(),
  //TODO: Add permissions middleware
);

router.post("/", useSchema(createTenantSchema), useController(createTenantController));

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getTenantInfoSchema),
  tenantEntityMiddleware("data.id"),
  useController(getTenantInfoController),
);

router.patch(
  "/:id",
  paramsMiddleware,
  useSchema(updateTenantSchema),
  tenantEntityMiddleware("data.id"),
  useController(updateTenantController),
);

router.delete(
  "/:id",
  paramsMiddleware,
  useSchema(deleteTenantSchema),
  tenantEntityMiddleware("data.id"),
  useController(deleteTenantController),
);
