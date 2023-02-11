import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  confirmLogoutSessionController,
  confirmLogoutSessionSchema,
  getLogoutSessionDataController,
  getLogoutSessionDataSchema,
  rejectLogoutSessionController,
  rejectLogoutSessionSchema,
} from "../../controller";

const router = new Router<any, any>();
export default router;

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getLogoutSessionDataSchema),
  useController(getLogoutSessionDataController),
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
