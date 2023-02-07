import { Router, useController } from "@lindorm-io/koa";
import { accountEntityMiddleware, identityAuthMiddleware } from "../middleware";
import { rtbfController } from "../controller";

const router = new Router();
export default router;

router.use(identityAuthMiddleware());

router.get(
  "/",
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(rtbfController),
);
