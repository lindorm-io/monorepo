import { ERROR_REDIRECT_URI } from "../../../constant";
import { ServerKoaContext } from "../../../types";
import { includes } from "lodash";
import { loginSessionCookieMiddleware, oidcSessionCookieMiddleware } from "../../../middleware";
import {
  Router,
  redirectErrorMiddleware,
  useAssertion,
  useController,
  useSchema,
} from "@lindorm-io/koa";
import {
  initialiseOidcController,
  initialiseOidcSchema,
  verifyOidcController,
  verifyOidcSchema,
} from "../../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.post(
  "/",
  useSchema(initialiseOidcSchema),
  loginSessionCookieMiddleware,
  useAssertion({
    assertion: includes,
    fromPath: {
      expect: "entity.loginSession.allowedOidc",
      actual: "data.identityProvider",
    },
    hint: "identityProvider",
  }),
  useController(initialiseOidcController),
);

router.get(
  "/callback",
  redirectErrorMiddleware({ redirectUri: ERROR_REDIRECT_URI }),
  useSchema(verifyOidcSchema),
  oidcSessionCookieMiddleware,
  loginSessionCookieMiddleware,
  useAssertion({
    fromPath: {
      expect: "entity.oidcSession.state",
      actual: "data.state",
    },
    hint: "state",
  }),
  useAssertion({
    fromPath: {
      expect: "entity.loginSession.id",
      actual: "entity.oidcSession.loginSessionId",
    },
    hint: "loginSessionId",
  }),
  useController(verifyOidcController),
);
