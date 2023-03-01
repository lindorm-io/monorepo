import { Router, useController, paramsMiddleware, useSchema } from "@lindorm-io/koa";
import { clientAuthMiddleware, identityEntityMiddleware } from "../../middleware";
import { addUserinfoController, addUserinfoSchema } from "../../controller";

const router = new Router<any, any>();
export default router;

router.use(
  clientAuthMiddleware(),
  //TODO: Add permissions middleware
);

router.put(
  "/:id",
  paramsMiddleware,
  useSchema(addUserinfoSchema),
  identityEntityMiddleware("data.id"),
  useController(addUserinfoController),
);
