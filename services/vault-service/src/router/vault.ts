import { ClientPermission, ClientScope } from "../common";
import { ServerKoaContext } from "../types";
import { clientAuthMiddleware, protectedRecordEntityMiddleware } from "../middleware";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  createProtectedRecordController,
  createProtectedRecordSchema,
  deleteProtectedRecordController,
  deleteProtectedRecordSchema,
  unlockProtectedRecordController,
  unlockProtectedRecordSchema,
} from "../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.post(
  "/",
  clientAuthMiddleware({
    permissions: [ClientPermission.VAULT_PUBLIC],
    scopes: [ClientScope.VAULT_PROTECTED_RECORD_WRITE],
  }),
  useSchema(createProtectedRecordSchema),
  useController(createProtectedRecordController),
);

router.post(
  "/:id/unlock",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.VAULT_PUBLIC],
    scopes: [ClientScope.VAULT_PROTECTED_RECORD_READ],
  }),
  useSchema(unlockProtectedRecordSchema),
  protectedRecordEntityMiddleware("data.id"),
  useController(unlockProtectedRecordController),
);

router.delete(
  "/:id",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.VAULT_PUBLIC],
    scopes: [ClientScope.VAULT_PROTECTED_RECORD_WRITE],
  }),
  useSchema(deleteProtectedRecordSchema),
  protectedRecordEntityMiddleware("data.id"),
  useController(deleteProtectedRecordController),
);
