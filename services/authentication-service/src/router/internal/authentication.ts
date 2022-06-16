import { ClientPermission } from "../../common";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { ServerKoaContext } from "../../types";
import { clientAuthMiddleware } from "../../middleware";
import {
  initialiseAuthenticationController,
  initialiseAuthenticationSchema,
} from "../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.post(
  "/",
  useSchema(initialiseAuthenticationSchema),
  clientAuthMiddleware({
    permissions: [ClientPermission.AUTHENTICATION_CONFIDENTIAL],
  }),
  useController(initialiseAuthenticationController),
);
