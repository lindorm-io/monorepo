import { ServerKoaContext } from "../../types";
import { ERROR_REDIRECT_URI } from "../../constant";
import { oauthAuthorizeController, oauthAuthorizeSchema } from "../../controller";
import {
  clientEntityMiddleware,
  browserSessionCookieMiddleware,
  idTokenMiddleware,
} from "../../middleware";
import {
  Router,
  redirectErrorMiddleware,
  useController,
  useSchema,
  useAssertion,
} from "@lindorm-io/koa";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.get(
  "/",
  redirectErrorMiddleware({ path: "data.redirectUri", redirectUri: ERROR_REDIRECT_URI }),
  useSchema(oauthAuthorizeSchema),
  clientEntityMiddleware("data.clientId"),
  useAssertion({
    expect: true,
    fromPath: { actual: "entity.client.active" },
  }),
  idTokenMiddleware("data.idTokenHint", { optional: true }),
  browserSessionCookieMiddleware,
  useController(oauthAuthorizeController),
);
