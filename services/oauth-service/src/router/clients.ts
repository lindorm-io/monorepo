import { Router } from "@lindorm-io/koa/dist/class/KoaApp";
import { paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
import {
  createClientController,
  createClientSchema,
  deleteClientController,
  deleteClientSchema,
  generateClientSecretController,
  generateClientSecretSchema,
  getClientController,
  getClientSchema,
  updateClientController,
  updateClientSchema,
} from "../controller";
import {
  clientEntityMiddleware,
  identityAuthMiddleware,
  tenantEntityMiddleware,
} from "../middleware";

const router = new Router<any, any>();
export default router;

router.use(
  identityAuthMiddleware(),
  //TODO: Add permissions middleware
);

router.post(
  "/",
  //TODO: Add permissions middleware
  useSchema(createClientSchema),
  tenantEntityMiddleware("data.tenantId"),
  useController(createClientController),
);

router.get(
  "/:id",
  paramsMiddleware,
  //TODO: Add permissions middleware
  useSchema(getClientSchema),
  clientEntityMiddleware("data.id"),
  tenantEntityMiddleware("entity.client.tenantId"),
  useController(getClientController),
);

router.patch(
  "/:id",
  paramsMiddleware,
  useSchema(updateClientSchema),
  clientEntityMiddleware("data.id"),
  tenantEntityMiddleware("entity.client.tenantId"),
  useController(updateClientController),
);

router.delete(
  "/:id",
  paramsMiddleware,
  useSchema(deleteClientSchema),
  clientEntityMiddleware("data.id"),
  tenantEntityMiddleware("entity.client.tenantId"),
  useController(deleteClientController),
);

router.get(
  "/:id/secret",
  paramsMiddleware,
  useSchema(generateClientSecretSchema),
  clientEntityMiddleware("data.id"),
  tenantEntityMiddleware("entity.client.tenantId"),
  useController(generateClientSecretController),
);
