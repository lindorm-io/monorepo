import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  getAuthorizationController,
  getAuthorizationSchema,
  redirectAuthorizationController,
  redirectAuthorizationSchema,
} from "../../../controller";
import {
  AuthorizationRequestEntityMiddleware,
  clientEntityMiddleware,
  tenantEntityMiddleware,
} from "../../../middleware";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getAuthorizationSchema),
  AuthorizationRequestEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.authorizationRequest.clientId"),
  tenantEntityMiddleware("entity.client.tenantId"),
  useController(getAuthorizationController),
);

router.get(
  "/:id/redirect",
  paramsMiddleware,
  useSchema(redirectAuthorizationSchema),
  AuthorizationRequestEntityMiddleware("data.id"),
  useController(redirectAuthorizationController),
);
