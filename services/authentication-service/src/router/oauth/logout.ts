import { ERROR_REDIRECT_URI } from "../../constant";
import { redirectLogoutSessionController, redirectLogoutSessionSchema } from "../../controller";
import { redirectErrorMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";

const router = new Router();
export default router;

router.get(
  "/",
  redirectErrorMiddleware({ redirectUri: ERROR_REDIRECT_URI }),
  useSchema(redirectLogoutSessionSchema),
  useController(redirectLogoutSessionController),
);
