import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  confirmElevationController,
  confirmElevationSchema,
  getElevationController,
  getElevationSchema,
  rejectElevationController,
  rejectElevationSchema,
} from "../../../controller";
import {
  clientEntityMiddleware,
  ElevationRequestEntityMiddleware,
  tenantEntityMiddleware,
} from "../../../middleware";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getElevationSchema),
  ElevationRequestEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.elevationRequest.clientId"),
  tenantEntityMiddleware("entity.client.tenantId"),
  useController(getElevationController),
);

router.post(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmElevationSchema),
  ElevationRequestEntityMiddleware("data.id"),
  useController(confirmElevationController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectElevationSchema),
  ElevationRequestEntityMiddleware("data.id"),
  useController(rejectElevationController),
);
