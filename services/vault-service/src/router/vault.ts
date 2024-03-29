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

export const router = new Router<any, any>();

router.use(clientAuthMiddleware());
//TODO: Add permissions middleware

router.post(
  "/",
  useSchema(createProtectedRecordSchema),
  useController(createProtectedRecordController),
);

router.post(
  "/:id/unlock",
  paramsMiddleware,
  useSchema(unlockProtectedRecordSchema),
  protectedRecordEntityMiddleware("data.id"),
  useController(unlockProtectedRecordController),
);

router.delete(
  "/:id",
  paramsMiddleware,
  useSchema(deleteProtectedRecordSchema),
  protectedRecordEntityMiddleware("data.id"),
  useController(deleteProtectedRecordController),
);
