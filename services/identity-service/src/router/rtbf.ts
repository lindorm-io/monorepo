import { Router, useController } from "@lindorm-io/koa";
import { identityAuthMiddleware, identityEntityMiddleware } from "../middleware";
import { rtbfController } from "../controller";

export const router = new Router<any, any>();

router.use(identityAuthMiddleware());

router.get(
  "/",
  identityEntityMiddleware("token.bearerToken.subject"),
  useController(rtbfController),
);
