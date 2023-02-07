import { Router, useController } from "@lindorm-io/koa";
import { identityAuthMiddleware } from "../middleware";
import { userinfoController } from "../controller";

const router = new Router();
export default router;

router.use(identityAuthMiddleware());

router.get("/", useController(userinfoController));
