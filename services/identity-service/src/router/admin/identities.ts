import { Router, paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
import { identityAdminController, identityAdminSchema } from "../../controller";
import { identityAuthMiddleware, identityEntityMiddleware } from "../../middleware";

const router = new Router();
export default router;

router.use(
  identityAuthMiddleware(),
  //TODO: Add permissions middleware
);

router.patch(
  "/:id",
  paramsMiddleware,
  useSchema(identityAdminSchema),
  identityEntityMiddleware("data.id"),
  useController(identityAdminController),
);
