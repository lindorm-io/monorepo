import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  confirmAuthorizationConsentController,
  confirmAuthorizationConsentSchema,
  confirmAuthorizationLoginController,
  confirmAuthorizationLoginSchema,
  confirmAuthorizationSelectAccountController,
  confirmAuthorizationSelectAccountSchema,
  getAuthorizationController,
  getAuthorizationSchema,
  redirectAuthorizationController,
  redirectAuthorizationSchema,
  rejectAuthorizationController,
  rejectAuthorizationSchema,
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

router.post(
  "/:id/consent",
  paramsMiddleware,
  useSchema(confirmAuthorizationConsentSchema),
  authorizationSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.authorizationSession.clientId"),
  useController(confirmAuthorizationConsentController),
);

router.post(
  "/:id/login",
  paramsMiddleware,
  useSchema(confirmAuthorizationLoginSchema),
  authorizationSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.authorizationSession.clientId"),
  useController(confirmAuthorizationLoginController),
);

router.get(
  "/:id/redirect",
  paramsMiddleware,
  useSchema(redirectAuthorizationSchema),
  authorizationSessionEntityMiddleware("data.id"),
  useController(redirectAuthorizationController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectAuthorizationSchema),
  authorizationSessionEntityMiddleware("data.id"),
  useController(rejectAuthorizationController),
);

router.post(
  "/:id/select-account",
  paramsMiddleware,
  useSchema(confirmAuthorizationSelectAccountSchema),
  authorizationSessionEntityMiddleware("data.id"),
  clientEntityMiddleware("entity.authorizationSession.clientId"),
  useController(confirmAuthorizationSelectAccountController),
);
