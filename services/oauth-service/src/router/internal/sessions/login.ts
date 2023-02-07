import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  authorizationSessionEntityMiddleware,
  clientAuthMiddleware,
  clientEntityMiddleware,
} from "../../../middleware";
import {
  confirmLoginController,
  confirmLoginSchema,
  getLoginDataController,
  getLoginDataSchema,
  rejectLoginController,
  rejectLoginSchema,
  redirectLoginController,
  redirectLoginSchema,
} from "../../../controller";

const router = new Router();
export default router;

router.use(
  clientAuthMiddleware(),
  //TODO: Add permissions middleware
);

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getLoginDataSchema),
  authorizationSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.authorizationSession.clientId"),
  useController(getLoginDataController),
);

router.post(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmLoginSchema),
  authorizationSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.authorizationSession.clientId"),
  useController(confirmLoginController),
);

router.get(
  "/:id/redirect",
  paramsMiddleware,
  useSchema(redirectLoginSchema),
  authorizationSessionEntityMiddleware("data.id"),
  useController(redirectLoginController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectLoginSchema),
  authorizationSessionEntityMiddleware("data.id"),
  useController(rejectLoginController),
);
