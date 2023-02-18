import { ERROR_REDIRECT_URI } from "../../constant";
import { Router, redirectErrorMiddleware, useController, useSchema } from "@lindorm-io/koa";
import { clientEntityMiddleware, idTokenMiddleware } from "../../middleware";
import { oauthAuthorizeController, oauthAuthorizeSchema } from "../../controller";

const router = new Router<any, any>();
export default router;

router.get(
  "/",
  redirectErrorMiddleware({ path: "data.redirectUri", redirectUri: ERROR_REDIRECT_URI }),
  useSchema(oauthAuthorizeSchema),
  clientEntityMiddleware("data.clientId"),
  idTokenMiddleware("data.idTokenHint", { optional: true }),
  useController(oauthAuthorizeController),
);
