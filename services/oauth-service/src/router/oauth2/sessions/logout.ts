import { ERROR_REDIRECT_URI } from "../../../constant";
import { Router, redirectErrorMiddleware, useController, useSchema } from "@lindorm-io/koa";
import {
  clientEntityMiddleware,
  idTokenMiddleware,
  logoutSessionEntityMiddleware,
} from "../../../middleware";
import {
  oauthLogoutController,
  oauthLogoutSchema,
  verifyLogoutController,
  verifyLogoutSchema,
} from "../../../controller";

const router = new Router<any, any>();
export default router;

router.get(
  "/",
  redirectErrorMiddleware({ path: "data.postLogoutRedirectUri", redirectUri: ERROR_REDIRECT_URI }),
  useSchema(oauthLogoutSchema),
  idTokenMiddleware("data.idTokenHint", { optional: true }),
  useController(oauthLogoutController),
);

router.post(
  "/",
  redirectErrorMiddleware({ path: "data.postLogoutRedirectUri", redirectUri: ERROR_REDIRECT_URI }),
  useSchema(oauthLogoutSchema),
  idTokenMiddleware("data.idTokenHint", { optional: true }),
  useController(oauthLogoutController),
);

router.get(
  "/verify",
  redirectErrorMiddleware({ path: "data.postLogoutRedirectUri", redirectUri: ERROR_REDIRECT_URI }),
  useSchema(verifyLogoutSchema),
  logoutSessionEntityMiddleware("data.session"),
  clientEntityMiddleware("entity.logoutSession.clientId"),
  useController(verifyLogoutController),
);
