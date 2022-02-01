import { Context } from "../../../types";
import { ClientPermission, ClientScope } from "../../../common";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  authorizationSessionEntityMiddleware,
  browserSessionEntityMiddleware,
  clientAuthMiddleware,
  clientEntityMiddleware,
} from "../../../middleware";
import {
  confirmAuthenticationController,
  confirmAuthenticationSchema,
  getAuthenticationInfoController,
  getAuthenticationInfoSchema,
  rejectAuthenticationController,
  rejectAuthenticationSchema,
  skipAuthenticationController,
  skipAuthenticationSchema,
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

  useSchema(getAuthenticationInfoSchema),
  authorizationSessionEntityMiddleware("data.id"),
  browserSessionEntityMiddleware("entity.authorizationSession.browserSessionId"),
  clientEntityMiddleware("entity.authorizationSession.clientId"),
  useController(getAuthenticationInfoController),
);

router.put(
  "/:id/confirm",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
    scopes: [ClientScope.OAUTH_AUTHENTICATION_WRITE],
  }),

  useSchema(confirmAuthenticationSchema),
  authorizationSessionEntityMiddleware("data.id"),
  browserSessionEntityMiddleware("entity.authorizationSession.browserSessionId"),
  useController(confirmAuthenticationController),
);

router.put(
  "/:id/reject",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
    scopes: [ClientScope.OAUTH_AUTHENTICATION_WRITE],
  }),

  useSchema(rejectAuthenticationSchema),
  authorizationSessionEntityMiddleware("data.id"),
  useController(rejectAuthenticationController),
);

router.put(
  "/:id/skip",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
    scopes: [ClientScope.OAUTH_AUTHENTICATION_WRITE],
  }),

  useSchema(skipAuthenticationSchema),
  authorizationSessionEntityMiddleware("data.id"),
  browserSessionEntityMiddleware("entity.authorizationSession.browserSessionId"),
  useController(skipAuthenticationController),
);
