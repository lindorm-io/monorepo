import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  confirmLoginSessionController,
  confirmLoginSessionSchema,
  getLoginSessionController,
  getLoginSessionSchema,
  rejectLoginSessionController,
  rejectLoginSessionSchema,
} from "../../controller";

export const router = new Router<any, any>();

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getLoginSessionSchema),
  useController(getLoginSessionController),
);

router.post(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmLoginSessionSchema),
  useController(confirmLoginSessionController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectLoginSessionSchema),
  useController(rejectLoginSessionController),
);
