import { ServerKoaContext } from "../types";
import { IdentityPermission, Scope } from "../common";
import { Router, useController } from "@lindorm-io/koa";
import { identityAuthMiddleware } from "../middleware";
import { userinfoController } from "../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.use(
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
);

router.get("/", useController(userinfoController));
