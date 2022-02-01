import { Context } from "../../../types";
import { Router, redirectErrorMiddleware, useController, useSchema } from "@lindorm-io/koa";
import {
  oauthVerifyAuthorizationController,
  oauthVerifyAuthorizationSchema,
} from "../../../controller";
import {
  authorizationSessionCookieMiddleware,
  browserSessionCookieMiddleware,
  clientEntityMiddleware,
  consentSessionEntityMiddleware,
} from "../../../middleware";
import { ERROR_REDIRECT_URI } from "../../../constant";

const router = new Router<unknown, Context>();
export default router;

router.get(
  "/verify",
  redirectErrorMiddleware({ path: "data.redirectUri", redirectUri: ERROR_REDIRECT_URI }),
  useSchema(oauthVerifyAuthorizationSchema),
  authorizationSessionCookieMiddleware,
  browserSessionCookieMiddleware,
  clientEntityMiddleware("entity.authorizationSession.clientId"),
  consentSessionEntityMiddleware("entity.authorizationSession.consentSessionId"),
  useController(oauthVerifyAuthorizationController),
);
