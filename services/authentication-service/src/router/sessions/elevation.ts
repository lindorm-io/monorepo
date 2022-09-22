import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { authenticationConfirmationTokenMiddleware } from "../../middleware";
import {
  confirmElevationSessionController,
  confirmElevationSessionSchema,
  getElevationSessionDataController,
  getElevationSessionDataSchema,
  rejectElevationSessionController,
  rejectElevationSessionSchema,
} from "../../controller";

const router = new Router();
export default router;

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getElevationSessionDataSchema),
  useController(getElevationSessionDataController),
);

router.post(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmElevationSessionSchema),
  authenticationConfirmationTokenMiddleware("data.authenticationConfirmationToken"),
  useController(confirmElevationSessionController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectElevationSessionSchema),
  useController(rejectElevationSessionController),
);
