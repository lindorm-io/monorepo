import { ClientPermission, ClientScope } from "../../common";
import { Context } from "../../types";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { clientAuthMiddleware } from "../../middleware";
import { emitSocketEventController, emitSocketEventSchema } from "../../controller";

const router = new Router<unknown, Context>();
export default router;

router.get(
  "/emit",
  clientAuthMiddleware({
    permissions: [ClientPermission.COMMUNICATION_CONFIDENTIAL],
    scopes: [ClientScope.COMMUNICATION_EVENT_EMIT],
  }),
  useSchema(emitSocketEventSchema),
  useController(emitSocketEventController),
);
