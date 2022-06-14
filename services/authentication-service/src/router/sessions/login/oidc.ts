import { Router, useController, useSchema } from "@lindorm-io/koa";
import { ServerKoaContext } from "../../../types";
import { loginSessionCookieMiddleware } from "../../../middleware";
import {
  confirmLoginWithOidcCallbackController,
  confirmLoginWithOidcCallbackSchema,
  initialiseLoginOidcController,
  initialiseLoginOidcSchema,
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
  useSchema(confirmLoginWithOidcCallbackSchema),
  loginSessionCookieMiddleware,
  useController(confirmLoginWithOidcCallbackController),
);
