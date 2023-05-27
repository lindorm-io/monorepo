import { Router, useController, useSchema } from "@lindorm-io/koa";
import { oauthTokenController, oauthTokenSchema } from "../../controller";
import { authenticateClientMiddleware } from "../../middleware";

export const router = new Router<any, any>();

router.post(
  "/",
  useSchema(oauthTokenSchema),
  authenticateClientMiddleware,
  useController(oauthTokenController),
);
