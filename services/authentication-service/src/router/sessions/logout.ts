import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  confirmLogoutSessionController,
  confirmLogoutSessionSchema,
  getLogoutSessionController,
  getLogoutSessionSchema,
  rejectLogoutSessionController,
  rejectLogoutSessionSchema,
} from "../../controller";

const router = new Router<any, any>();
export default router;

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getLogoutSessionSchema),
  useController(getLogoutSessionController),
);

router.post(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmLogoutSessionSchema),
  useController(confirmLogoutSessionController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectLogoutSessionSchema),
  useController(rejectLogoutSessionController),
);
