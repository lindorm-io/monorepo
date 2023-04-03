import { Router, useController } from "@lindorm-io/koa";
import { identityAuthMiddleware } from "../middleware";
import { rtbfController } from "../controller";

export const router = new Router<any, any>();

router.use(identityAuthMiddleware());

router.get("/", useController(rtbfController));
