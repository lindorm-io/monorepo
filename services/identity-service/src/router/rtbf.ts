import { Router, useController } from "@lindorm-io/koa";
import { identityAuthMiddleware, identityEntityMiddleware } from "../middleware";
import { rtbfController } from "../controller";

const router = new Router();
export default router;

router.use(identityAuthMiddleware());

router.get(
  "/",
  identityEntityMiddleware("token.bearerToken.subject"),
  useController(rtbfController),
);
