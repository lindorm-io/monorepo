import { Router, useController, paramsMiddleware, useSchema } from "@lindorm-io/koa";
import { clientAuthMiddleware } from "../../middleware";
import { findIdentityController, findIdentitySchema } from "../../controller";

const router = new Router<any, any>();
export default router;

router.use(
  clientAuthMiddleware(),
  //TODO: Add permissions middleware
);

router.get(
  "/",
  paramsMiddleware,
  useSchema(findIdentitySchema),
  useController(findIdentityController),
);
