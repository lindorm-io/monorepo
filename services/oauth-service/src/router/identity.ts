import { Context } from "../types";
import { IdentityPermission, Scope } from "../common";
import { Router, useController } from "@lindorm-io/koa";
import { forgetIdentityController } from "../controller";
import { identityAuthMiddleware } from "../middleware";

const router = new Router<unknown, Context>();
export default router;

router.use(
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
);

router.post("/forget", useController(forgetIdentityController));
