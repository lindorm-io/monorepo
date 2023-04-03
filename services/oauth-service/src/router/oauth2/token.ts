import { Router, useController, useSchema } from "@lindorm-io/koa";
import { assertClientMiddleware } from "../../middleware";
import { oauthTokenController, oauthTokenSchema } from "../../controller";

export const router = new Router<any, any>();

router.post(
  "/",
  useSchema(oauthTokenSchema),
  assertClientMiddleware,
  useController(oauthTokenController),
);
