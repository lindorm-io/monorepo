import { Router, useController, useSchema } from "@lindorm-io/koa";
import {
  initialisePostElevationController,
  initialisePostElevationSchema,
  initialiseRedirectElevationController,
  initialiseRedirectElevationSchema,
  verifyElevationController,
  verifyElevationSchema,
} from "../../../controller";
import {
  ElevationRequestEntityMiddleware,
  clientEntityMiddleware,
  customIdentityAuthMiddleware,
  idTokenMiddleware,
} from "../../../middleware";

export const router = new Router<any, any>();

router.use(customIdentityAuthMiddleware);

router.get(
  "/",
  useSchema(initialiseRedirectElevationSchema),
  clientEntityMiddleware("data.clientId"),
  idTokenMiddleware("data.idTokenHint", { optional: true }),
  useController(initialiseRedirectElevationController),
);

router.post(
  "/",
  useSchema(initialisePostElevationSchema),
  clientEntityMiddleware("data.clientId"),
  idTokenMiddleware("data.idTokenHint", { optional: true }),
  useController(initialisePostElevationController),
);

router.get(
  "/verify",
  useSchema(verifyElevationSchema),
  ElevationRequestEntityMiddleware("data.session"),
  useController(verifyElevationController),
);
