import { ERROR_REDIRECT_URI } from "../../constant";
import { redirectLoginSessionController, redirectLoginSessionSchema } from "../../controller";
import { redirectErrorMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";

const router = new Router<any, any>();
export default router;

router.get(
  "/",
  redirectErrorMiddleware({ redirectUri: ERROR_REDIRECT_URI }),
  useSchema(redirectLoginSessionSchema),
  useController(redirectLoginSessionController),
);
