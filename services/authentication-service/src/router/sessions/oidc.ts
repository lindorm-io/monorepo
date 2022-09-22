import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { confirmOidcController, confirmOidcSchema } from "../../controller";

const router = new Router();
export default router;

router.get(
  "/callback",
  paramsMiddleware,
  useSchema(confirmOidcSchema),
  useController(confirmOidcController),
);
