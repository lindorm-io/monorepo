import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  confirmElevationSessionController,
  confirmElevationSessionSchema,
  getElevationSessionController,
  getElevationSessionSchema,
  rejectElevationSessionController,
  rejectElevationSessionSchema,
} from "../../controller";
import { authenticationConfirmationTokenMiddleware } from "../../middleware";

export const router = new Router<any, any>();

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
