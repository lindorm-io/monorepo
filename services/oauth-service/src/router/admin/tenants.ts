import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { tenantEntityMiddleware } from "../../middleware";
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

export const router = new Router<any, any>();

//TODO: Add permissions middleware

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
