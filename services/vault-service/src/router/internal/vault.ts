import { ClientPermission, ClientScope } from "../../common";
import { ServerKoaContext } from "../../types";
import { clientAuthMiddleware, encryptedRecordEntityMiddleware } from "../../middleware";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  createEncryptedRecordController,
  createEncryptedRecordSchema,
  deleteEncryptedRecordController,
  deleteEncryptedRecordSchema,
  getEncryptedRecordController,
  getEncryptedRecordSchema,
} from "../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.post(
  "/",
  clientAuthMiddleware({
    permissions: [ClientPermission.VAULT_CONFIDENTIAL],
    scopes: [ClientScope.VAULT_ENCRYPTED_RECORD_WRITE],
  }),
  useSchema(createEncryptedRecordSchema),
  useController(createEncryptedRecordController),
);

router.get(
  "/:id",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.VAULT_CONFIDENTIAL],
    scopes: [ClientScope.VAULT_ENCRYPTED_RECORD_READ],
  }),
  useSchema(getEncryptedRecordSchema),
  encryptedRecordEntityMiddleware("data.id"),
  useController(getEncryptedRecordController),
);

router.delete(
  "/:id",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.VAULT_CONFIDENTIAL],
    scopes: [ClientScope.VAULT_ENCRYPTED_RECORD_WRITE],
  }),
  useSchema(deleteEncryptedRecordSchema),
  encryptedRecordEntityMiddleware("data.id"),
  useController(deleteEncryptedRecordController),
);
