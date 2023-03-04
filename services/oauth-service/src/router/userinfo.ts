import { Router, useController } from "@lindorm-io/koa";
import { customIdentityAuthMiddleware } from "../middleware";
import { userinfoController } from "../controller";

const router = new Router<any, any>();
export default router;

router.use(customIdentityAuthMiddleware);

router.get("/", useController(userinfoController));

router.post("/", useController(userinfoController));
