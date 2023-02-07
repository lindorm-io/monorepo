import { Router, useController, useSchema } from "@lindorm-io/koa";
import { clientAuthMiddleware } from "../../middleware";
import { emitSocketEventController, emitSocketEventSchema } from "../../controller";

const router = new Router();
export default router;

router.use(
  clientAuthMiddleware(),
  //TODO: Add permissions middleware
);

router.get("/emit", useSchema(emitSocketEventSchema), useController(emitSocketEventController));
