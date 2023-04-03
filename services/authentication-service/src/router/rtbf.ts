import { Router, useController } from "@lindorm-io/koa";
import { accountEntityMiddleware, identityAuthMiddleware } from "../middleware";
import { rtbfController } from "../controller";

export const router = new Router<any, any>();

router.use(identityAuthMiddleware());

router.get(
  "/",
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(rtbfController),
);
