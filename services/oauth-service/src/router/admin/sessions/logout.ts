import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  clientEntityMiddleware,
  logoutSessionEntityMiddleware,
  tenantEntityMiddleware,
} from "../../../middleware";
import {
  confirmLogoutController,
  confirmLogoutSchema,
  getLogoutController,
  getLogoutSchema,
  redirectLogoutController,
  redirectLogoutSchema,
  rejectLogoutController,
  rejectLogoutSchema,
} from "../../../controller";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getLogoutSchema),
  logoutSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.logoutSession.clientId"),
  tenantEntityMiddleware("entity.client.tenantId"),
  useController(getLogoutController),
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
