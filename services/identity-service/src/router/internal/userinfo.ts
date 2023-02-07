import { Router, useController, paramsMiddleware, useSchema } from "@lindorm-io/koa";
import { clientAuthMiddleware, identityEntityMiddleware } from "../../middleware";
import { putUserinfoController, putUserinfoSchema } from "../../controller";

const router = new Router();
export default router;

router.use(
  clientAuthMiddleware(),
  //TODO: Add permissions middleware
);

router.put(
  "/:id",
  paramsMiddleware,
  useSchema(putUserinfoSchema),
  identityEntityMiddleware("data.id"),
  useController(putUserinfoController),
);
