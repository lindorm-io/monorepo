import { Router, paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
import {
  elevationSessionEntityMiddleware,
  clientAuthMiddleware,
  clientEntityMiddleware,
} from "../../../middleware";
import {
  confirmElevationController,
  confirmElevationSchema,
  getElevationController,
  getElevationSchema,
  rejectElevationController,
  rejectElevationSchema,
} from "../../../controller";

const router = new Router<any, any>();
export default router;

router.use(
  clientAuthMiddleware(),
  //TODO: Add permissions middleware
);

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getElevationSchema),
  elevationSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.elevationSession.clientId"),
  useController(getElevationController),
);

router.post(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmElevationSchema),
  elevationSessionEntityMiddleware("data.id"),
  useController(confirmElevationController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectElevationSchema),
  elevationSessionEntityMiddleware("data.id"),
  useController(rejectElevationController),
);
