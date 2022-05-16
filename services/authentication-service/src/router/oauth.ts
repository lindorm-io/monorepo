import { ServerKoaContext } from "../types";
import { ERROR_REDIRECT_URI } from "../constant";
import { redirectErrorMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  oauthConsentController,
  oauthConsentSchema,
  oauthLoginController,
  oauthLoginSchema,
  oauthLogoutController,
  oauthLogoutSchema,
} from "../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.get(
  "/consent",
  redirectErrorMiddleware({ redirectUri: ERROR_REDIRECT_URI }),
  useSchema(oauthConsentSchema),
  useController(oauthConsentController),
);

router.get(
  "/login",
  redirectErrorMiddleware({ redirectUri: ERROR_REDIRECT_URI }),
  useSchema(oauthLoginSchema),
  useController(oauthLoginController),
);

router.get(
  "/logout",
  redirectErrorMiddleware({ redirectUri: ERROR_REDIRECT_URI }),
  useSchema(oauthLogoutSchema),
  useController(oauthLogoutController),
);
