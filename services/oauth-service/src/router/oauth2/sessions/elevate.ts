import { Router } from "@lindorm-io/koa/dist/class/KoaApp";
import { useController, useSchema } from "@lindorm-io/koa";
import {
  clientEntityMiddleware,
  elevationSessionEntityMiddleware,
  identityAuthMiddleware,
  idTokenMiddleware,
} from "../../../middleware";
import {
  elevateController,
  elevateSchema,
  verifyElevationController,
  verifyElevationSchema,
} from "../../../controller";

const router = new Router<any, any>();
export default router;

router.post(
  "/",
  useSchema(elevateSchema),
  identityAuthMiddleware(),
  clientEntityMiddleware("data.clientId"),
  idTokenMiddleware("data.idTokenHint", { optional: true }),
  useController(elevateController),
);

router.get(
  "/verify",
  useSchema(verifyElevationSchema),
  identityAuthMiddleware(),
  elevationSessionEntityMiddleware("data.sessionId"),
  useController(verifyElevationController),
);
