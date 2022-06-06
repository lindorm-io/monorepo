import { ClientPermission, ClientScope } from "../../common";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { ServerKoaContext } from "../../types";
import { clientAuthMiddleware } from "../../middleware";
import { emitSocketEventController, emitSocketEventSchema } from "../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.get(
  "/emit",
  useSchema(emitSocketEventSchema),
  clientAuthMiddleware({
    permissions: [ClientPermission.COMMUNICATION_CONFIDENTIAL],
    scopes: [ClientScope.COMMUNICATION_EVENT_EMIT],
  }),
  useController(emitSocketEventController),
);
