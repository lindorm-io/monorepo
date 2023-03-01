import { Router, useController, useSchema } from "@lindorm-io/koa";
import { clientAuthMiddleware } from "../../middleware";
import { getClaimsController, getClaimsSchema } from "../../controller";

const router = new Router<any, any>();
export default router;

router.use(clientAuthMiddleware());

router.get("/", useSchema(getClaimsSchema), useController(getClaimsController));
