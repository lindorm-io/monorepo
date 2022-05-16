import { ServerKoaContext } from "../../../types";
import {
  clientEntityMiddleware,
  idTokenMiddleware,
  logoutSessionCookieMiddleware,
} from "../../../middleware";
import {
  oauthLogoutController,
  oauthLogoutSchema,
  oauthVerifyLogoutController,
  oauthVerifyLogoutSchema,
} from "../../../controller";
import {
  Router,
  redirectErrorMiddleware,
  useController,
  useSchema,
  useAssertion,
} from "@lindorm-io/koa";
import { ERROR_REDIRECT_URI } from "../../../constant";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.get(
  "/",
  redirectErrorMiddleware({ path: "data.redirectUri", redirectUri: ERROR_REDIRECT_URI }),
  useSchema(oauthLogoutSchema),
  clientEntityMiddleware("data.clientId"),
  useAssertion({
    expect: true,
    fromPath: { actual: "entity.client.active" },
  }),
  idTokenMiddleware("data.idTokenHint", { optional: true }),
  useController(oauthLogoutController),
);

router.get(
  "/verify",
  redirectErrorMiddleware({ path: "data.redirectUri", redirectUri: ERROR_REDIRECT_URI }),
  useSchema(oauthVerifyLogoutSchema),
  logoutSessionCookieMiddleware,
  useController(oauthVerifyLogoutController),
);
