import { ClientPermission } from "../../../common";
import { elevationSessionEntityMiddleware, clientAuthMiddleware } from "../../../middleware";
import { Router, paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
import {
  confirmElevationController,
  confirmElevationSchema,
  getElevationDataController,
  getElevationDataSchema,
  rejectElevationController,
  rejectElevationSchema,
} from "../../../controller";

const router = new Router();
export default router;

router.use(
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
  }),
);

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getElevationDataSchema),
  elevationSessionEntityMiddleware("data.id"),
  useController(getElevationDataController),
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
