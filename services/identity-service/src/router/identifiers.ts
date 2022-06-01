import { ServerKoaContext } from "../types";
import {
  connectSessionEntityMiddleware,
  identityAuthMiddleware,
  identityEntityMiddleware,
} from "../middleware";
import { useController, paramsMiddleware, Router, useSchema } from "@lindorm-io/koa";
import {
  identifierConnectInitialiseController,
  identifierConnectInitialiseSchema,
  identifierConnectVerifyController,
  identifierConnectVerifySchema,
} from "../controller";
import { IdentityPermission, Scope } from "../common";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.post(
  "/connect",
  useSchema(identifierConnectInitialiseSchema),
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  identityEntityMiddleware("token.bearerToken.subject"),
  useController(identifierConnectInitialiseController),
);

router.post(
  "/connect/:id/verify",
  paramsMiddleware,
  useSchema(identifierConnectVerifySchema),
  connectSessionEntityMiddleware("data.id"),
  identityAuthMiddleware({
    scopes: [Scope.OPENID],
    fromPath: { subject: "entity.connectSessionId.identityId" },
  }),
  useController(identifierConnectVerifyController),
);
