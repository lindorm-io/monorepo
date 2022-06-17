import { ClientPermission } from "../../common";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { ServerKoaContext } from "../../types";
import { clientAuthMiddleware } from "../../middleware";
import { emitSocketEventController, emitSocketEventSchema } from "../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.use(
  clientAuthMiddleware({
    permissions: [ClientPermission.COMMUNICATION_CONFIDENTIAL],
  }),
);

router.get("/emit", useSchema(emitSocketEventSchema), useController(emitSocketEventController));
