import { IdentityPermission, Scope } from "../common";
import { Router, useController } from "@lindorm-io/koa";
import { ServerKoaContext } from "../types";
import { rtbfController } from "../controller";
import { identityAuthMiddleware, identityEntityMiddleware } from "../middleware";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.get(
  "/",
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  identityEntityMiddleware("token.bearerToken.subject"),
  useController(rtbfController),
);
