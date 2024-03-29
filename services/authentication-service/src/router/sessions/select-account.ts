import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  confirmSelectAccountController,
  confirmSelectAccountSchema,
  getSelectAccountController,
  getSelectAccountSchema,
  rejectSelectAccountController,
  rejectSelectAccountSchema,
} from "../../controller";

export const router = new Router<any, any>();

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getSelectAccountSchema),
  useController(getSelectAccountController),
);

router.post(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmSelectAccountSchema),
  useController(confirmSelectAccountController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectSelectAccountSchema),
  useController(rejectSelectAccountController),
);
