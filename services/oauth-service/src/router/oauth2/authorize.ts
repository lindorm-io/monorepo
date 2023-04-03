import { ERROR_REDIRECT_URI } from "../../constant";
import { redirectErrorMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { clientEntityMiddleware, idTokenMiddleware } from "../../middleware";
import { oauthAuthorizeController, oauthAuthorizeSchema } from "../../controller";

export const router = new Router<any, any>();

router.get(
  "/",
  redirectErrorMiddleware({ path: "data.redirectUri", redirectUri: ERROR_REDIRECT_URI }),
  useSchema(oauthAuthorizeSchema),
  clientEntityMiddleware("data.clientId"),
  idTokenMiddleware("data.idTokenHint", { optional: true }),
  useController(oauthAuthorizeController),
);
