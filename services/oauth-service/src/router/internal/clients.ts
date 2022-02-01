import { ClientPermission, ClientScope } from "../../common";
import { Context } from "../../types";
import { clientAuthMiddleware, clientEntityMiddleware } from "../../middleware";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  approveClientController,
  approveClientSchema,
  createClientController,
  createClientSchema,
  deleteClientController,
  deleteClientSchema,
  generateClientSecretController,
  generateClientSecretSchema,
  getClientInfoController,
  getClientInfoSchema,
  revokeClientController,
  revokeClientSchema,
  updateClientDataController,
  updateClientDataSchema,
  updateClientPermissionsController,
  updateClientPermissionsSchema,
  updateClientTypeController,
  updateClientTypeSchema,
} from "../../controller";

const router = new Router<unknown, Context>();
export default router;

router.post(
  "/",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
    scopes: [ClientScope.OAUTH_CLIENT_WRITE],
  }),

  useSchema(createClientSchema),
  useController(createClientController),
);

router.get(
  "/:id",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
    scopes: [ClientScope.OAUTH_CLIENT_READ],
  }),

  useSchema(getClientInfoSchema),
  clientEntityMiddleware("data.id"),
  useController(getClientInfoController),
);

router.patch(
  "/:id",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
    scopes: [ClientScope.OAUTH_CLIENT_WRITE],
  }),

  useSchema(updateClientDataSchema),
  clientEntityMiddleware("data.id"),
  useController(updateClientDataController),
);

router.delete(
  "/:id",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
    scopes: [ClientScope.OAUTH_CLIENT_DELETE],
  }),

  useSchema(deleteClientSchema),
  clientEntityMiddleware("data.id"),
  useController(deleteClientController),
);

router.patch(
  "/:id/approve",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
    scopes: [ClientScope.OAUTH_CLIENT_WRITE],
  }),

  useSchema(approveClientSchema),
  clientEntityMiddleware("data.id"),
  useController(approveClientController),
);

router.patch(
  "/:id/permissions",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
    scopes: [ClientScope.OAUTH_CLIENT_WRITE],
  }),

  useSchema(updateClientPermissionsSchema),
  clientEntityMiddleware("data.id"),
  useController(updateClientPermissionsController),
);

router.patch(
  "/:id/revoke",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
    scopes: [ClientScope.OAUTH_CLIENT_WRITE],
  }),

  useSchema(revokeClientSchema),
  clientEntityMiddleware("data.id"),
  useController(revokeClientController),
);

router.get(
  "/:id/secret",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
    scopes: [ClientScope.OAUTH_CLIENT_WRITE],
  }),

  useSchema(generateClientSecretSchema),
  clientEntityMiddleware("data.id"),
  useController(generateClientSecretController),
);

router.patch(
  "/:id/type",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
    scopes: [ClientScope.OAUTH_CLIENT_WRITE],
  }),

  useSchema(updateClientTypeSchema),
  clientEntityMiddleware("data.id"),
  useController(updateClientTypeController),
);
