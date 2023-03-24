import { ERROR_REDIRECT_URI } from "../../constant";
import { redirectSelectAccountController, redirectSelectAccountSchema } from "../../controller";
import { redirectErrorMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";

const router = new Router<any, any>();
export default router;

router.get(
  "/",
  redirectErrorMiddleware({ redirectUri: ERROR_REDIRECT_URI }),
  useSchema(redirectSelectAccountSchema),
  useController(redirectSelectAccountController),
);
