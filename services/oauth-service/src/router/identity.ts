import { ServerKoaContext } from "../types";
import { IdentityPermission, Scope } from "../common";
import { Router, useController } from "@lindorm-io/koa";
import { forgetIdentityController } from "../controller";
import { identityAuthMiddleware } from "../middleware";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.use(
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
);

router.post("/rtbf", useController(forgetIdentityController));
