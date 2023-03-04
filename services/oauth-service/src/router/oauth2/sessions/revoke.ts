import { Router, useController, useSchema } from "@lindorm-io/koa";
import { revokeTokenController, revokeTokenSchema } from "../../../controller";
import { assertClientMiddleware } from "../../../middleware";

const router = new Router<any, any>();
export default router;

router.post(
  "/",
  useSchema(revokeTokenSchema),
  assertClientMiddleware,
  useController(revokeTokenController),
);
