import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  authorizationSessionEntityMiddleware,
  clientAuthMiddleware,
  clientEntityMiddleware,
} from "../../../middleware";
import {
  confirmSelectAccountController,
  confirmSelectAccountSchema,
  rejectSelectAccountController,
  rejectSelectAccountSchema,
  redirectSelectAccountController,
  redirectSelectAccountSchema,
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
  useSchema(confirmSelectAccountSchema),
  authorizationSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.authorizationSession.clientId"),
  useController(confirmSelectAccountController),
);

router.get(
  "/:id/redirect",
  paramsMiddleware,
  useSchema(redirectSelectAccountSchema),
  authorizationSessionEntityMiddleware("data.id"),
  useController(redirectSelectAccountController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectSelectAccountSchema),
  authorizationSessionEntityMiddleware("data.id"),
  useController(rejectSelectAccountController),
);
