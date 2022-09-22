import { ClientPermission } from "../../../common";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  clientAuthMiddleware,
  clientEntityMiddleware,
  logoutSessionEntityMiddleware,
} from "../../../middleware";
import {
  confirmLogoutController,
  confirmLogoutSchema,
  getLogoutDataController,
  getLogoutDataSchema,
  redirectLogoutController,
  redirectLogoutSchema,
  rejectLogoutController,
  rejectLogoutSchema,
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
  useSchema(getLogoutDataSchema),
  logoutSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.logoutSession.clientId"),
  useController(getLogoutDataController),
);

router.post(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmLogoutSchema),
  logoutSessionEntityMiddleware("data.id"),
  useController(confirmLogoutController),
);

router.get(
  "/:id/redirect",
  paramsMiddleware,
  useSchema(redirectLogoutSchema),
  logoutSessionEntityMiddleware("data.id"),
  useController(redirectLogoutController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectLogoutSchema),
  logoutSessionEntityMiddleware("data.id"),
  useController(rejectLogoutController),
);
