import { authenticationConfirmationTokenMiddleware } from "../../middleware";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  confirmLoginSessionController,
  confirmLoginSessionSchema,
  getLoginSessionDataController,
  getLoginSessionDataSchema,
  rejectLoginSessionController,
  rejectLoginSessionSchema,
} from "../../controller";

const router = new Router();
export default router;

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getLoginSessionDataSchema),
  useController(getLoginSessionDataController),
);

router.post(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmLoginSessionSchema),
  authenticationConfirmationTokenMiddleware("data.authenticationConfirmationToken"),
  useController(confirmLoginSessionController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectLoginSessionSchema),
  useController(rejectLoginSessionController),
);
