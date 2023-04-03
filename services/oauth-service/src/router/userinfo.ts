import { Router, useController } from "@lindorm-io/koa";
import { customIdentityAuthMiddleware } from "../middleware";
import { userinfoController } from "../controller";

export const router = new Router<any, any>();

router.use(customIdentityAuthMiddleware);

router.get("/", useController(userinfoController));

router.post("/", useController(userinfoController));
