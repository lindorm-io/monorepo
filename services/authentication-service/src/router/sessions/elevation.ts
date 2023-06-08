import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  confirmElevationSessionController,
  confirmElevationSessionSchema,
  getElevationSessionController,
  getElevationSessionSchema,
  rejectElevationSessionController,
  rejectElevationSessionSchema,
} from "../../controller";

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
  useController(confirmElevationSessionController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectElevationSessionSchema),
  useController(rejectElevationSessionController),
);
