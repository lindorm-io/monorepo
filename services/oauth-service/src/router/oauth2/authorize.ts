import { redirectErrorMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { ERROR_REDIRECT_URI } from "../../constant";
import { oauthAuthorizeController, oauthAuthorizeSchema } from "../../controller";
import { clientEntityMiddleware, idTokenMiddleware } from "../../middleware";

export const router = new Router<any, any>();

router.get(
  "/",
  redirectErrorMiddleware({ path: "data.redirectUri", redirectUri: ERROR_REDIRECT_URI }),
  useSchema(oauthAuthorizeSchema),
  clientEntityMiddleware("data.clientId"),
  idTokenMiddleware("data.idTokenHint", { optional: true }),
  useController(oauthAuthorizeController),
);
