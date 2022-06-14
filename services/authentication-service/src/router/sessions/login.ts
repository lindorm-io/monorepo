import { ServerKoaContext } from "../../types";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { loginSessionCookieMiddleware } from "../../middleware";
import {
  acknowledgeLoginController,
  confirmLoginWithAuthenticationTokenController,
  confirmLoginWithAuthenticationTokenSchema,
  confirmLoginWithOidcCallbackController,
  confirmLoginWithOidcCallbackSchema,
  initialiseLoginOidcController,
  initialiseLoginOidcSchema,
  rejectLoginController,
} from "../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.get("/acknowledge", loginSessionCookieMiddleware, useController(acknowledgeLoginController));

router.get(
  "/confirm",
  useSchema(confirmLoginWithAuthenticationTokenSchema),
  loginSessionCookieMiddleware,
  useController(confirmLoginWithAuthenticationTokenController),
);

router.post(
  "/oidc",
  useSchema(initialiseLoginOidcSchema),
  loginSessionCookieMiddleware,
  useController(initialiseLoginOidcController),
);

router.get(
  "/oidc/callback",
  useSchema(confirmLoginWithOidcCallbackSchema),
  loginSessionCookieMiddleware,
  useController(confirmLoginWithOidcCallbackController),
);

router.get("/reject", loginSessionCookieMiddleware, useController(rejectLoginController));
