import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  confirmElevationRequestController,
  confirmElevationRequestSchema,
  getElevationRequestController,
  getElevationRequestSchema,
  rejectElevationRequestController,
  rejectElevationRequestSchema,
} from "../../controller";
import { authenticationConfirmationTokenMiddleware } from "../../middleware";

export const router = new Router<any, any>();

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getElevationRequestSchema),
  useController(getElevationRequestController),
);

router.post(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmElevationRequestSchema),
  authenticationConfirmationTokenMiddleware("data.authenticationConfirmationToken"),
  useController(confirmElevationRequestController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectElevationRequestSchema),
  useController(rejectElevationRequestController),
);
