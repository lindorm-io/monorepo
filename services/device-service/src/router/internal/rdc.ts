import { Router, useController, useSchema } from "@lindorm-io/koa";
import { clientAuthMiddleware } from "../../middleware";
import { initialiseRdcController, initialiseRdcSchema } from "../../controller";

const router = new Router();
export default router;

router.use(
  clientAuthMiddleware(),
  //TODO: Add permissions middleware
);

router.post("/", useSchema(initialiseRdcSchema), useController(initialiseRdcController));
