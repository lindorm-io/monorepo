import { Router, useController } from "@lindorm-io/koa";
import { getUserinfoController } from "../controller";
import { identityAuthMiddleware, identityEntityMiddleware } from "../middleware";

export const router = new Router<any, any>();

router.use(identityAuthMiddleware());

router.get(
  "/",
  identityEntityMiddleware("token.bearerToken.subject"),
  useController(getUserinfoController),
);
