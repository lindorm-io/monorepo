import { ServerKoaContext } from "../../../types";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { loginSessionCookieMiddleware } from "../../../middleware";
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
  useController(confirmLoginWithAuthenticationTokenController),
);

router.get("/reject", loginSessionCookieMiddleware, useController(rejectLoginController));
