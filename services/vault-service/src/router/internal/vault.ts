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

const router = new Router<any, any>();
export default router;

router.use(
  clientAuthMiddleware(),
  //TODO: Add permissions middleware
);

router.post(
  "/",
  useSchema(createEncryptedRecordSchema),
  useController(createEncryptedRecordController),
);

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getEncryptedRecordSchema),
  encryptedRecordEntityMiddleware("data.id"),
  useController(getEncryptedRecordController),
);

router.delete(
  "/:id",
  paramsMiddleware,
  useSchema(deleteEncryptedRecordSchema),
  encryptedRecordEntityMiddleware("data.id"),
  useController(deleteEncryptedRecordController),
);
