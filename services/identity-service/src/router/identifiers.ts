import { Context } from "../types";
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
import { Scope } from "../common";

const router = new Router<unknown, Context>();
export default router;

router.post(
  "/connect",
  paramsMiddleware,
  useSchema(identifierConnectInitialiseSchema),
  identityAuthMiddleware({
    scopes: [Scope.OPENID],
    fromPath: { subject: "data.identityId" },
  }),
  identityEntityMiddleware("data.identityId"),
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
