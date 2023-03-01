import { clientAuthMiddleware } from "../../middleware";
import { getIdentitySessionsController, getIdentitySessionsSchema } from "../../controller";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";

const router = new Router<any, any>();
export default router;

router.use(
  clientAuthMiddleware(),
  //TODO: Add permissions middleware
);

router.get(
  "/:id/sessions",
  paramsMiddleware,
  useSchema(getIdentitySessionsSchema),
  useController(getIdentitySessionsController),
);
