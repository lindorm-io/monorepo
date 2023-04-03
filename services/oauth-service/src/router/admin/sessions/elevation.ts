import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  clientEntityMiddleware,
  elevationSessionEntityMiddleware,
  tenantEntityMiddleware,
} from "../../../middleware";
import {
  confirmElevationController,
  confirmElevationSchema,
  getElevationController,
  getElevationSchema,
  rejectElevationController,
  rejectElevationSchema,
} from "../../../controller";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getElevationSchema),
  elevationSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.elevationSession.clientId"),
  tenantEntityMiddleware("entity.client.tenantId"),
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
