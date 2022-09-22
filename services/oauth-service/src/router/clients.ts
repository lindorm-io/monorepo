import { IdentityPermission } from "../common";
import { Router } from "@lindorm-io/koa/dist/class/KoaApp";
import { paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
import {
  createClientController,
  createClientSchema,
  deleteClientController,
  deleteClientSchema,
  generateClientSecretController,
  generateClientSecretSchema,
  getClientInfoController,
  getClientInfoSchema,
  updateClientController,
  updateClientSchema,
} from "../controller";
import {
  clientEntityMiddleware,
  identityAuthMiddleware,
  tenantEntityMiddleware,
} from "../middleware";

const router = new Router();
export default router;

router.post(
  "/",
  identityAuthMiddleware({
    permissions: [IdentityPermission.CLIENT_WRITE],
  }),
  useSchema(createClientSchema),
  tenantEntityMiddleware("data.tenantId"),
  useController(createClientController),
);

router.get(
  "/:id",
  paramsMiddleware,
  identityAuthMiddleware({
    permissions: [IdentityPermission.CLIENT_READ],
  }),
  useSchema(getClientInfoSchema),
  clientEntityMiddleware("data.id"),
  tenantEntityMiddleware("entity.client.tenantId"),
  useController(getClientInfoController),
);

router.patch(
  "/:id",
  paramsMiddleware,
  identityAuthMiddleware({
    permissions: [IdentityPermission.CLIENT_WRITE],
  }),
  useSchema(updateClientSchema),
  clientEntityMiddleware("data.id"),
  tenantEntityMiddleware("entity.client.tenantId"),
  useController(updateClientController),
);

router.delete(
  "/:id",
  paramsMiddleware,
  identityAuthMiddleware({
    permissions: [IdentityPermission.CLIENT_WRITE],
  }),
  useSchema(deleteClientSchema),
  clientEntityMiddleware("data.id"),
  tenantEntityMiddleware("entity.client.tenantId"),
  useController(deleteClientController),
);

router.get(
  "/:id/secret",
  paramsMiddleware,
  identityAuthMiddleware({
    permissions: [IdentityPermission.CLIENT_WRITE],
  }),
  useSchema(generateClientSecretSchema),
  clientEntityMiddleware("data.id"),
  tenantEntityMiddleware("entity.client.tenantId"),
  useController(generateClientSecretController),
);
