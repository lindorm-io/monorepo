import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { clientEntityMiddleware, tenantEntityMiddleware } from "../../middleware";
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
} from "../../controller";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.post(
  "/",
  useSchema(createClientSchema),
  tenantEntityMiddleware("data.tenantId"),
  useController(createClientController),
);

router.get(
  "/:id",
  paramsMiddleware,
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
