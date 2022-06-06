import { IdentityPermission, Scope } from "../common";
import { Router } from "@lindorm-io/koa/dist/class/KoaApp";
import { ServerKoaContext } from "../types";
import { paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
import {
  connectSessionEntityMiddleware,
  identifierEntityMiddleware,
  identityAuthMiddleware,
  identityEntityMiddleware,
} from "../middleware";
import {
  deleteIdentifierController,
  deleteIdentifierSchema,
  initialiseIdentifierConnectSessionController,
  initialiseIdentifierConnectSessionSchema,
  setPrimaryIdentifierController,
  setPrimaryIdentifierSchema,
  verifyIdentifierConnectSessionController,
  verifyIdentifierConnectSessionSchema,
} from "../controller";
import {
  setIdentifierLabelController,
  setIdentifierLabelSchema,
} from "../controller/identifier/set-identifier-label";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.delete(
  "/",
  useSchema(deleteIdentifierSchema),
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  identityEntityMiddleware("token.bearerToken.subject"),
  useController(deleteIdentifierController),
);

router.post(
  "/connect",
  useSchema(initialiseIdentifierConnectSessionSchema),
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  identityEntityMiddleware("token.bearerToken.subject"),
  useController(initialiseIdentifierConnectSessionController),
);

router.post(
  "/connect/:id/verify",
  paramsMiddleware,
  useSchema(verifyIdentifierConnectSessionSchema),
  connectSessionEntityMiddleware("data.id"),
  identifierEntityMiddleware("entity.connectSession.identifierId"),
  useController(verifyIdentifierConnectSessionController),
);

router.post(
  "/set-label",
  useSchema(setIdentifierLabelSchema),
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  identityEntityMiddleware("token.bearerToken.subject"),
  useController(setIdentifierLabelController),
);

router.post(
  "/set-primary",
  useSchema(setPrimaryIdentifierSchema),
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  identityEntityMiddleware("token.bearerToken.subject"),
  useController(setPrimaryIdentifierController),
);
