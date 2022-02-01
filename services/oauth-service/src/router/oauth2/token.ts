import { Context } from "../../types";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { assertClientMiddleware } from "../../middleware";
import { oauthTokenController, oauthTokenSchema } from "../../controller";

const router = new Router<unknown, Context>();
export default router;

router.post(
  "/",
  useSchema(oauthTokenSchema),
  assertClientMiddleware,
  useController(oauthTokenController),
);
