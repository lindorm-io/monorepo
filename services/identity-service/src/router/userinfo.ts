import { Router, useController } from "@lindorm-io/koa";
import { getUserinfoController } from "../controller";
import { identityAuthMiddleware, identityEntityMiddleware } from "../middleware";

const router = new Router<any, any>();
export default router;

router.use(identityAuthMiddleware());

router.get(
  "/",
  identityEntityMiddleware("token.bearerToken.subject"),
  useController(getUserinfoController),
);
