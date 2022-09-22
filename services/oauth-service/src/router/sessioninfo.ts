import { IdentityPermission } from "../common";
import { Router, useController } from "@lindorm-io/koa";
import { identityAuthMiddleware } from "../middleware";
import { sessioninfoController } from "../controller";

const router = new Router();
export default router;

router.use(
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
  }),
);

router.get("/", useController(sessioninfoController));
