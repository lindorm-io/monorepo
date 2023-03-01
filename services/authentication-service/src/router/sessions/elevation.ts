import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { authenticationConfirmationTokenMiddleware } from "../../middleware";
import {
  confirmElevationSessionController,
  confirmElevationSessionSchema,
  getElevationSessionController,
  getElevationSessionSchema,
  rejectElevationSessionController,
  rejectElevationSessionSchema,
} from "../../controller";

const router = new Router<any, any>();
export default router;

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getElevationSessionSchema),
  useController(getElevationSessionController),
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
