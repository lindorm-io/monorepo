import { clientAuthMiddleware } from "../../middleware";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { authenticateIdentifierController, authenticateIdentifierSchema } from "../../controller";

const router = new Router();
export default router;

router.use(
  clientAuthMiddleware(),
  //TODO: Add permissions middleware
);

router.post(
  "/",
  paramsMiddleware,
  useSchema(authenticateIdentifierSchema),
  useController(authenticateIdentifierController),
);
