import { Context } from "../../../types";
import { ClientPermission, ClientScope } from "../../../common";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  authorizationSessionEntityMiddleware,
  browserSessionEntityMiddleware,
  clientAuthMiddleware,
  clientEntityMiddleware,
  consentSessionEntityMiddleware,
} from "../../../middleware";
import {
  confirmConsentController,
  confirmConsentSchema,
  getConsentInfoController,
  getConsentInfoSchema,
  rejectConsentController,
  rejectConsentSchema,
  skipConsentController,
  skipConsentSchema,
} from "../../../controller";

const router = new Router<unknown, Context>();
export default router;

router.get(
  "/:id",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
    scopes: [ClientScope.OAUTH_AUTHENTICATION_READ],
  }),

  useSchema(getConsentInfoSchema),
  authorizationSessionEntityMiddleware("data.id"),
  browserSessionEntityMiddleware("entity.authorizationSession.browserSessionId"),
  clientEntityMiddleware("entity.authorizationSession.clientId"),
  useController(getConsentInfoController),
);

router.put(
  "/:id/confirm",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
    scopes: [ClientScope.OAUTH_AUTHENTICATION_WRITE],
  }),

  useSchema(confirmConsentSchema),
  authorizationSessionEntityMiddleware("data.id"),
  browserSessionEntityMiddleware("entity.authorizationSession.browserSessionId"),
  consentSessionEntityMiddleware("entity.authorizationSession.consentSessionId"),
  useController(confirmConsentController),
);

router.put(
  "/:id/reject",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
    scopes: [ClientScope.OAUTH_AUTHENTICATION_WRITE],
  }),

  useSchema(rejectConsentSchema),
  authorizationSessionEntityMiddleware("data.id"),
  useController(rejectConsentController),
);

router.put(
  "/:id/skip",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
    scopes: [ClientScope.OAUTH_AUTHENTICATION_WRITE],
  }),

  useSchema(skipConsentSchema),
  authorizationSessionEntityMiddleware("data.id"),
  browserSessionEntityMiddleware("entity.authorizationSession.browserSessionId"),
  consentSessionEntityMiddleware("entity.authorizationSession.consentSessionId"),
  useController(skipConsentController),
);
