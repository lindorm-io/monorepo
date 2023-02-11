import { Router, useController } from "@lindorm-io/koa";
import { clientAuthMiddleware } from "../../middleware";
import { getPrivateJwksController } from "../../controller";

const router = new Router<any, any>();
export default router;

router.use(
  clientAuthMiddleware(),
  //TODO: Add permissions middleware
);

router.get("/", useController(getPrivateJwksController));
