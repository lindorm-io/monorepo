import { ERROR_REDIRECT_URI } from "../../constant";
import { ServerKoaContext } from "../../types";
import { initialiseConsentController, initialiseConsentSchema } from "../../controller";
import { redirectErrorMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.get(
  "/",
  redirectErrorMiddleware({ redirectUri: ERROR_REDIRECT_URI }),
  useSchema(initialiseConsentSchema),
  useController(initialiseConsentController),
);
