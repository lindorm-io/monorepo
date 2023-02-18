import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  authorizationSessionEntityMiddleware,
  clientAuthMiddleware,
  clientEntityMiddleware,
} from "../../../middleware";
import {
  confirmConsentController,
  confirmConsentSchema,
  rejectConsentController,
  rejectConsentSchema,
  redirectConsentController,
  redirectConsentSchema,
} from "../../../controller";

const router = new Router<any, any>();
export default router;

router.use(
  clientAuthMiddleware(),
  //TODO: Add permissions middleware
);

router.post(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmConsentSchema),
  authorizationSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.authorizationSession.clientId"),
  useController(confirmConsentController),
);

router.get(
  "/:id/redirect",
  paramsMiddleware,
  useSchema(redirectConsentSchema),
  authorizationSessionEntityMiddleware("data.id"),
  useController(redirectConsentController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectConsentSchema),
  authorizationSessionEntityMiddleware("data.id"),
  useController(rejectConsentController),
);
