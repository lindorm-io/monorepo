import { ERROR_REDIRECT_URI } from "../../../constant";
import { Router, redirectErrorMiddleware, useController, useSchema } from "@lindorm-io/koa";
import { ServerKoaContext } from "../../../types";
import { loginSessionCookieMiddleware } from "../../../middleware";
import {
  initialiseLoginOidcController,
  initialiseLoginOidcSchema,
  loginOidcCallbackController,
  loginOidcCallbackSchema,
} from "../../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.post(
  "/",
  useSchema(initialiseLoginOidcSchema),
  loginSessionCookieMiddleware,
  useController(initialiseLoginOidcController),
);

router.get(
  "/callback",
  redirectErrorMiddleware({ redirectUri: ERROR_REDIRECT_URI }),
  useSchema(loginOidcCallbackSchema),
  loginSessionCookieMiddleware,
  useController(loginOidcCallbackController),
);
