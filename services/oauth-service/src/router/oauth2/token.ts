import { Router, useController, useSchema } from "@lindorm-io/koa";
import { assertClientMiddleware } from "../../middleware";
import { oauthTokenController, oauthTokenSchema } from "../../controller";

const router = new Router<any, any>();
export default router;

router.post(
  "/",
  useSchema(oauthTokenSchema),
  assertClientMiddleware,
  useController(oauthTokenController),
);
