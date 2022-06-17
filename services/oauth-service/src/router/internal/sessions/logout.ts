import { ServerKoaContext } from "../../../types";
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
  getLogoutInfoController,
  getLogoutInfoSchema,
  rejectLogoutController,
  rejectLogoutSchema,
} from "../../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.use(
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
  }),
);

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getLogoutInfoSchema),
  logoutSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.logoutSession.clientId"),
  useController(getLogoutInfoController),
);

router.put(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmLogoutSchema),
  logoutSessionEntityMiddleware("data.id"),
  useController(confirmLogoutController),
);

router.put(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectLogoutSchema),
  logoutSessionEntityMiddleware("data.id"),
  useController(rejectLogoutController),
);
