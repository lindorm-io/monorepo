import { ServerKoaContext } from "../../types";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { assertClientMiddleware } from "../../middleware";
import { oauthTokenController, oauthTokenSchema } from "../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.post(
  "/",
  useSchema(oauthTokenSchema),
  assertClientMiddleware,
  useController(oauthTokenController),
);
