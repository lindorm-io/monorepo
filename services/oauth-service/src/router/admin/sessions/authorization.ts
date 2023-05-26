import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  getAuthorizationController,
  getAuthorizationSchema,
  redirectAuthorizationController,
  redirectAuthorizationSchema,
} from "../../../controller";
import {
  authorizationSessionEntityMiddleware,
  clientEntityMiddleware,
  tenantEntityMiddleware,
} from "../../../middleware";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getAuthorizationSchema),
  authorizationSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.authorizationSession.clientId"),
  tenantEntityMiddleware("entity.client.tenantId"),
  useController(getAuthorizationController),
);

router.get(
  "/:id/redirect",
  paramsMiddleware,
  useSchema(redirectAuthorizationSchema),
  authorizationSessionEntityMiddleware("data.id"),
  useController(redirectAuthorizationController),
);
