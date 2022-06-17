import { ServerKoaContext } from "../../../types";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import {
  authenticationConfirmationTokenMiddleware,
  authenticationSessionEntityMiddleware,
  loginSessionCookieMiddleware,
} from "../../../middleware";
import {
  confirmLoginWithAuthenticationTokenController,
  confirmLoginWithAuthenticationTokenSchema,
  getLoginInfoController,
  rejectLoginController,
} from "../../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.get("/", loginSessionCookieMiddleware, useController(getLoginInfoController));

router.get(
  "/confirm",
  useSchema(confirmLoginWithAuthenticationTokenSchema),
  loginSessionCookieMiddleware,
  authenticationConfirmationTokenMiddleware("data.authenticationConfirmationToken"),
  useController(confirmLoginWithAuthenticationTokenController),
);

router.get(
  "/reject",
  loginSessionCookieMiddleware,
  authenticationSessionEntityMiddleware("entity.loginSession.authenticationSessionId"),
  useController(rejectLoginController),
);
