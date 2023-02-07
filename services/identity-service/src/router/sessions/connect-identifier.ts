import { LindormScopes } from "@lindorm-io/common-types";
import { Router, paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
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

const router = new Router();
export default router;

router.post(
  "/",
  useSchema(initialiseIdentifierConnectSessionSchema),
  identityAuthMiddleware({ scopes: [LindormScopes.OPENID] }),
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
