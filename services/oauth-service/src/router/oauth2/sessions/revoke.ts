import { Router, useController, useSchema } from "@lindorm-io/koa";
import { revokeTokenController, revokeTokenSchema } from "../../../controller";
import { assertClientMiddleware } from "../../../middleware";

export const router = new Router<any, any>();

router.post(
  "/",
  useSchema(revokeTokenSchema),
  assertClientMiddleware,
  useController(revokeTokenController),
);
