import { Context } from "../../../types";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { oauthRevokeController, oauthRevokeSchema } from "../../../controller";
import { assertClientMiddleware } from "../../../middleware";

const router = new Router<unknown, Context>();
export default router;

router.post(
  "/",
  useSchema(oauthRevokeSchema),
  assertClientMiddleware,
  useController(oauthRevokeController),
);
