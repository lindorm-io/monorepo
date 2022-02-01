import { Context } from "../../../types";
import { ClientPermission, ClientScope } from "../../../common";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  clientAuthMiddleware,
  clientEntityMiddleware,
  logoutSessionEntityMiddleware,
} from "../../../middleware";
import {
  confirmLogoutController,
  confirmLogoutSchema,
  getLogoutInfoController,
  getLogoutInfoSchema,
  rejectLogoutController,
  rejectLogoutSchema,
} from "../../../controller";

const router = new Router<unknown, Context>();
export default router;

router.get(
  "/:id",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
    scopes: [ClientScope.OAUTH_LOGOUT_READ],
  }),

  useSchema(getLogoutInfoSchema),
  logoutSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.logoutSession.clientId"),
  useController(getLogoutInfoController),
);

router.put(
  "/:id/confirm",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
    scopes: [ClientScope.OAUTH_LOGOUT_WRITE],
  }),

  useSchema(confirmLogoutSchema),
  logoutSessionEntityMiddleware("data.id"),
  useController(confirmLogoutController),
);

router.put(
  "/:id/reject",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
    scopes: [ClientScope.OAUTH_LOGOUT_WRITE],
  }),

  useSchema(rejectLogoutSchema),
  logoutSessionEntityMiddleware("data.id"),
  useController(rejectLogoutController),
);
