import { IdentityPermission, Scope } from "../../common";
import { Router } from "@lindorm-io/koa";
import { ServerKoaContext } from "../../types";
import { paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
import {
  connectSessionEntityMiddleware,
  identifierEntityMiddleware,
  identityAuthMiddleware,
  identityEntityMiddleware,
} from "../../middleware";
import {
  initialiseIdentifierConnectSessionController,
  initialiseIdentifierConnectSessionSchema,
  verifyIdentifierConnectSessionController,
  verifyIdentifierConnectSessionSchema,
} from "../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.post(
  "/",
  useSchema(initialiseIdentifierConnectSessionSchema),
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  identityEntityMiddleware("token.bearerToken.subject"),
  useController(initialiseIdentifierConnectSessionController),
);

router.post(
  "/:id/verify",
  paramsMiddleware,
  useSchema(verifyIdentifierConnectSessionSchema),
  connectSessionEntityMiddleware("data.id"),
  identifierEntityMiddleware("entity.connectSession.identifierId"),
  useController(verifyIdentifierConnectSessionController),
);
